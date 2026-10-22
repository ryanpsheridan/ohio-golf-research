// Captures the public Ohio Golf Club pages for the style guide research.
// Polite by design: checks robots.txt first, visits one page at a time,
// waits at least MIN_DELAY_MS between navigations, and only visits PAGES.
//
// Usage: node scripts/capture.mjs [--base https://www.ohiogolfclubindoor.com] [--only home,team]

import { chromium, request } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const BASE = (argValue('--base') ?? 'https://www.ohiogolfclubindoor.com').replace(/\/$/, '');
const ONLY = argValue('--only')?.split(',');
const ROOT = path.resolve(argValue('--out') ?? '.');
const RAW = path.join(ROOT, 'raw');
const CSS_DIR = path.join(RAW, 'css');
const SHOTS = path.join(ROOT, 'screenshots');

const MIN_DELAY_MS = 2500;
const WIDTHS = [390, 768, 1440];
const HEIGHTS = { 390: 844, 768: 1024, 1440: 900 };
const SETTLE_MS = 4000; // extra wait after scrolling, the home page reviews load late
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 ogc-style-research';

const PAGES = [
  { name: 'home', path: '/' },
  { name: 'team', path: '/team' },
  { name: 'events', path: '/events' },
  { name: 'contact-us', path: '/contact-us' },
  { name: 'fall-league', path: '/fall-league' },
  { name: 'carls-place', path: '/carls-place' },
  { name: 'privacy', path: '/privacy' },
  { name: 'terms', path: '/terms' },
].filter((p) => !ONLY || ONLY.includes(p.name));

// Computed properties recorded for every visible element.
const PROPS = [
  'color', 'background-color', 'background-image', 'font-family', 'font-size', 'font-weight',
  'font-style', 'line-height', 'letter-spacing', 'text-transform', 'text-decoration-line',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'gap', 'row-gap', 'column-gap',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
  'box-shadow', 'opacity', 'display', 'position', 'max-width', 'width',
  'transition-property', 'transition-duration', 'transition-timing-function', 'transition-delay',
  'animation-name', 'animation-duration', 'animation-timing-function', 'outline-color', 'outline-style', 'outline-width',
];

let lastNavigation = 0;

// Honor HTTPS_PROXY when set (Playwright ignores it by default).
const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy;
const proxyOption = PROXY ? { proxy: { server: PROXY } } : {};

const log = { base: BASE, startedAt: new Date().toISOString(), robots: null, pages: [], stylesheets: [], fonts: {}, notes: [] };

// Minimal robots.txt parser: rules for "*" and any group naming our agent token.
function parseRobots(text) {
  const groups = [];
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const [key, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    const k = key.trim().toLowerCase();
    if (k === 'user-agent') {
      if (!current || current.rules.length) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
    } else if ((k === 'allow' || k === 'disallow') && current) {
      current.rules.push({ allow: k === 'allow', path: value });
    } else if (k === 'crawl-delay' && current) {
      current.crawlDelay = Number(value);
    }
  }
  const mine = groups.filter((g) => g.agents.some((a) => a === 'ogc-style-research'));
  const applicable = mine.length ? mine : groups.filter((g) => g.agents.includes('*'));
  return {
    crawlDelay: Math.max(0, ...applicable.map((g) => g.crawlDelay || 0)),
    allows(p) {
      // Longest matching rule wins, Allow wins ties (Google semantics).
      let best = null;
      for (const g of applicable) {
        for (const r of g.rules) {
          if (r.path === '') continue;
          const re = new RegExp('^' + r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
          if (re.test(p) && (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow))) best = r;
        }
      }
      return !best || best.allow;
    },
  };
}

// Runs in the page: walk visible elements and record computed values.
function collectComputed(props) {
  const shortSelector = (el) => {
    const parts = [];
    let node = el;
    for (let depth = 0; node && node.nodeType === 1 && depth < 4; depth++, node = node.parentElement) {
      let part = node.tagName.toLowerCase();
      if (node.id) {
        parts.unshift(part + '#' + node.id);
        break;
      }
      const cls = [...node.classList].filter((c) => c.length < 40).slice(0, 2);
      if (cls.length) part += '.' + cls.join('.');
      parts.unshift(part);
    }
    return parts.join(' > ');
  };
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'META', 'LINK', 'BR'].includes(el.tagName)) continue;
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (rect.width === 0 || rect.height === 0 || cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
    const values = {};
    for (const p of props) values[p] = cs.getPropertyValue(p);
    const ownText = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    out.push({
      tag: el.tagName.toLowerCase(),
      classes: [...el.classList],
      id: el.id || undefined,
      selector: shortSelector(el),
      role: el.getAttribute('role') || undefined,
      href: el.tagName === 'A' ? el.getAttribute('href') : undefined,
      text: ownText.slice(0, 80) || undefined,
      hasText: ownText.length > 0,
      rect: { x: Math.round(rect.x), y: Math.round(rect.y + scrollY), w: Math.round(rect.width), h: Math.round(rect.height) },
      ...values,
    });
  }
  return out;
}

async function slowScroll(page) {
  await page.evaluate(async () => {
    const step = Math.max(200, Math.round(innerHeight * 0.6));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 350));
    }
    scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => setTimeout(r, 600));
    scrollTo(0, 0);
  });
}

async function settle(page) {
  try {
    await page.waitForLoadState('networkidle', { timeout: 20000 });
  } catch {
    log.notes.push(`networkidle timed out on ${page.url()}, continued after timeout`);
  }
  await slowScroll(page);
  await page.waitForTimeout(SETTLE_MS);
  try {
    await page.waitForLoadState('networkidle', { timeout: 10000 });
  } catch {}
}

const seenCss = new Map(); // url -> file name
async function saveStylesheets(page, context, pageName) {
  const { links, inline } = await page.evaluate(() => ({
    links: [...document.querySelectorAll('link[rel~="stylesheet"][href]')].map((l) => l.href),
    inline: [...document.querySelectorAll('style')].map((s) => s.textContent),
  }));
  for (const url of links) {
    if (seenCss.has(url)) continue;
    const file = createHash('sha1').update(url).digest('hex').slice(0, 10) + '.css';
    seenCss.set(url, file);
    try {
      const res = await context.request.get(url, { timeout: 20000 });
      await writeFile(path.join(CSS_DIR, file), await res.body());
      log.stylesheets.push({ url, file, status: res.status(), firstSeenOn: pageName });
    } catch (e) {
      log.stylesheets.push({ url, file: null, error: String(e.message || e), firstSeenOn: pageName });
    }
  }
  // Inline <style> blocks hold builder output (often the real theme), keep them too.
  const inlineText = inline.filter(Boolean).join('\n\n/* ---- next <style> block ---- */\n\n');
  if (inlineText) await writeFile(path.join(CSS_DIR, `inline-${pageName}.css`), inlineText);
}

async function recordFonts(page, pageName, fontResponses) {
  const faces = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].map((f) => ({ family: f.family.replace(/["']/g, ''), weight: f.weight, style: f.style, status: f.status }));
  });
  log.fonts[pageName] = { faces, files: [...fontResponses] };
}

// Hover and focus capture on the home page at 1440.
async function captureStates(page) {
  const statesDir = path.join(SHOTS, 'states');
  await mkdir(statesDir, { recursive: true });
  const groups = {
    button: 'button, a[class*="btn" i], a[class*="button" i], [role="button"], input[type="submit"]',
    nav: 'header a, nav a',
    card: '[class*="card" i], [class*="tile" i], [class*="feature" i]',
  };
  const results = [];
  for (const [group, selector] of Object.entries(groups)) {
    const handles = await page.$$(selector);
    let n = 0;
    for (const h of handles) {
      if (n >= 12) break;
      if (!(await h.isVisible())) continue;
      const box = await h.boundingBox();
      if (!box || box.width < 8 || box.height < 8) continue;
      n++;
      const id = `${group}-${String(n).padStart(2, '0')}`;
      const read = () =>
        h.evaluate((el) => {
          const cs = getComputedStyle(el);
          const keys = ['color', 'background-color', 'background-image', 'border-top-color', 'box-shadow', 'text-decoration-line', 'opacity', 'transform', 'outline-color', 'outline-style', 'outline-width', 'outline-offset'];
          return Object.fromEntries(keys.map((k) => [k, cs.getPropertyValue(k)]));
        });
      const info = await h.evaluate((el) => ({ tag: el.tagName.toLowerCase(), classes: [...el.classList], text: el.innerText?.trim().slice(0, 60) }));
      try {
        await h.scrollIntoViewIfNeeded();
        await page.mouse.move(0, 0);
        await page.waitForTimeout(400);
        const rest = await read();
        await h.screenshot({ path: path.join(statesDir, `${id}-rest.png`) });
        await h.hover();
        await page.waitForTimeout(600);
        const hover = await read();
        await h.screenshot({ path: path.join(statesDir, `${id}-hover.png`) });
        await page.mouse.move(0, 0);
        await h.focus().catch(() => {});
        await page.keyboard.press('Shift'); // nudges :focus-visible heuristics without activating anything
        await page.waitForTimeout(400);
        const focus = await read();
        await h.screenshot({ path: path.join(statesDir, `${id}-focus.png`) });
        await h.evaluate((el) => el.blur());
        const diff = (a, b) => Object.fromEntries(Object.keys(a).filter((k) => a[k] !== b[k]).map((k) => [k, { from: a[k], to: b[k] }]));
        results.push({ id, group, ...info, rest, hoverChanges: diff(rest, hover), focusChanges: diff(rest, focus) });
      } catch (e) {
        results.push({ id, group, ...info, error: String(e.message || e) });
      }
    }
  }
  await writeFile(path.join(RAW, 'states-home-1440.json'), JSON.stringify(results, null, 2));
}

// Mobile menu: open the toggle (no navigation) so the expanded nav can be documented.
async function captureMobileMenu(page, pageName) {
  const toggle = await page.$('[aria-label*="menu" i], [class*="hamburger" i], [class*="burger" i], [class*="menu-toggle" i], button[aria-expanded]');
  const navigates = toggle && (await toggle.evaluate((el) => el.tagName === 'A' && !!el.getAttribute('href') && !el.getAttribute('href').startsWith('#')));
  if (!toggle || navigates || !(await toggle.isVisible())) {
    log.notes.push(`${pageName} 390: no visible mobile menu toggle found`);
    return;
  }
  await page.evaluate(() => scrollTo(0, 0));
  await toggle.click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(SHOTS, `${pageName}-390-menu-open.png`) });
  const menu = await page.evaluate(collectComputed, PROPS);
  await writeFile(path.join(RAW, `computed-${pageName}-390-menu-open.json`), JSON.stringify(menu));
}

async function main() {
  await mkdir(CSS_DIR, { recursive: true });
  await mkdir(SHOTS, { recursive: true });

  const browser = await chromium.launch(proxyOption);
  try {
    // robots.txt first. If it cannot be read, stop rather than guess.
    const robotsUrl = BASE + '/robots.txt';
    const api = await request.newContext({ userAgent: USER_AGENT, ...proxyOption });
    let status, robotsText;
    try {
      const r = await api.get(robotsUrl, { timeout: 20000 });
      status = r.status();
      robotsText = status === 200 ? await r.text() : '';
    } catch (e) {
      throw new Error(`Could not read ${robotsUrl} (${e.message}). Stopping without crawling.`);
    } finally {
      await api.dispose();
    }
    lastNavigation = Date.now();
    if (status >= 500) throw new Error(`robots.txt returned HTTP ${status}. Stopping without crawling.`);
    await writeFile(path.join(RAW, 'robots.txt'), robotsText || `(robots.txt returned HTTP ${status}, treated as allow all)\n`);
    const robots = parseRobots(robotsText);
    log.robots = { url: robotsUrl, status, crawlDelaySeconds: robots.crawlDelay };
    const delay = Math.max(MIN_DELAY_MS, robots.crawlDelay * 1000);

    for (const pg of PAGES) {
      const entry = { ...pg, url: BASE + pg.path, widths: {} };
      log.pages.push(entry);
      if (!robots.allows(pg.path)) {
        entry.skipped = 'disallowed by robots.txt';
        console.log(`skip ${pg.path}: disallowed by robots.txt`);
        continue;
      }
      for (const width of WIDTHS) {
        const context = await browser.newContext({ viewport: { width, height: HEIGHTS[width] }, userAgent: USER_AGENT, deviceScaleFactor: 1 });
        const page = await context.newPage();
        const fontResponses = new Set();
        page.on('response', (res) => {
          const type = res.request().resourceType();
          if (type === 'font' || /\.(woff2?|ttf|otf)(\?|$)/i.test(res.url())) fontResponses.add(res.url());
        });
        const wait = lastNavigation + delay - Date.now();
        if (wait > 0) await new Promise((res) => setTimeout(res, wait));
        lastNavigation = Date.now();
        console.log(`load ${pg.path} @ ${width}`);
        let response;
        try {
          response = await page.goto(entry.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        } catch (e) {
          entry.widths[width] = { error: String(e.message || e) };
          await context.close();
          continue;
        }
        const status = response?.status() ?? 0;
        entry.finalUrl = page.url();
        entry.widths[width] = { status, capturedAt: new Date().toISOString() };
        if (status === 404) {
          entry.notFound = true;
          console.log(`  404, noted and skipped`);
          await context.close();
          break;
        }
        await settle(page);

        await page.screenshot({ path: path.join(SHOTS, `${pg.name}-${width}.png`), fullPage: true });
        const computed = await page.evaluate(collectComputed, PROPS);
        await writeFile(path.join(RAW, `computed-${pg.name}-${width}.json`), JSON.stringify(computed));
        entry.widths[width].elements = computed.length;
        entry.widths[width].documentHeight = await page.evaluate(() => document.documentElement.scrollHeight);

        if (width === 1440) {
          await writeFile(path.join(RAW, `${pg.name}.html`), await page.content());
          await saveStylesheets(page, context, pg.name);
          await recordFonts(page, pg.name, fontResponses);
          if (pg.name === 'home') await captureStates(page);
        }
        if (width === 390) await captureMobileMenu(page, pg.name);
        await context.close();
      }
    }
  } finally {
    await browser.close();
    log.finishedAt = new Date().toISOString();
    await writeFile(path.join(RAW, 'capture-log.json'), JSON.stringify(log, null, 2));
  }
  console.log('done, see raw/capture-log.json');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
