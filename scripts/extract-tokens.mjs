// Builds tokens/tokens.json (W3C design tokens format) and tokens/report.json
// (every observed value with counts and locations) from raw/ capture output.
//
// Usage: node scripts/extract-tokens.mjs [--out .]
// Everything here is inferred from the rendered site. Role names and proposed
// scales are suggestions, the observed values are kept alongside them.

import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const ROOT = path.resolve(args.includes('--out') ? args[args.indexOf('--out') + 1] : '.');
const RAW = path.join(ROOT, 'raw');
const OUT = path.join(ROOT, 'tokens');

// ---------- color helpers ----------
function parseColor(str) {
  const m = str?.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/);
  if (!m) return null;
  let a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return { r: +m[1], g: +m[2], b: +m[3], a: Math.round(a * 1000) / 1000 };
}
const hex2 = (n) => Math.round(n).toString(16).padStart(2, '0');
const toHex = (c) => '#' + hex2(c.r) + hex2(c.g) + hex2(c.b) + (c.a < 1 ? hex2(c.a * 255) : '');
function toLab({ r, g, b }) {
  const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const deltaE = (a, b) => Math.hypot(...toLab(a).map((v, i) => v - toLab(b)[i])) + Math.abs(a.a - b.a) * 100;
function hsl({ r, g, b }) {
  [r, g, b] = [r / 255, g / 255, b / 255];
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}
// Colors within this CIE76 distance are reported as one cluster (never merged silently).
const CLUSTER_DELTA_E = 6;

// ---------- generic counting ----------
class Counter {
  constructor() { this.map = new Map(); }
  add(value, where) {
    if (value === undefined || value === null || value === '') return;
    const e = this.map.get(value) ?? { value, count: 0, pages: new Set(), examples: [] };
    e.count++;
    if (where) {
      e.pages.add(where.page);
      if (e.examples.length < 5 && !e.examples.some((x) => x.selector === where.selector)) e.examples.push({ page: where.page, width: where.width, selector: where.selector, text: where.text });
    }
    this.map.set(value, e);
  }
  list() {
    return [...this.map.values()].sort((a, b) => b.count - a.count).map((e) => ({ ...e, pages: [...e.pages] }));
  }
}
const px = (v) => (typeof v === 'string' && /^-?[\d.]+px$/.test(v) ? parseFloat(v) : null);

async function main() {
  const files = (await readdir(RAW)).filter((f) => /^computed-.+-(390|768|1440)\.json$/.test(f));
  if (!files.length) throw new Error('No raw/computed-*.json files. Run scripts/capture.mjs first.');

  const colorUse = { text: new Counter(), surface: new Counter(), border: new Counter(), other: new Counter() };
  const allColors = new Counter();
  const gradients = new Counter();
  const families = new Counter(), sizes = new Counter(), weights = new Counter(), lineHeights = new Counter(), letterSpacing = new Counter(), transforms = new Counter();
  const textStyles = new Counter();
  const padding = new Counter(), margin = new Counter(), gaps = new Counter();
  const radii = new Counter(), borders = new Counter(), shadows = new Counter();
  const maxWidths = new Counter();
  const transitions = new Counter(), animations = new Counter();
  const headingSizes = new Counter();
  const widthsByPage = {};

  for (const f of files) {
    const [, page, width] = f.match(/^computed-(.+)-(\d+)\.json$/);
    const els = JSON.parse(await readFile(path.join(RAW, f), 'utf8'));
    widthsByPage[page] ??= [];
    widthsByPage[page].push(+width);
    for (const el of els) {
      const where = { page, width: +width, selector: el.selector, text: el.text };
      const addColor = (bucket, v) => {
        const c = parseColor(v);
        if (!c || c.a === 0) return;
        const h = toHex(c);
        colorUse[bucket].add(h, where);
        allColors.add(h, where);
      };
      if (el.hasText) addColor('text', el.color);
      addColor('surface', el['background-color']);
      const sides = ['top', 'right', 'bottom', 'left'].filter((side) => el[`border-${side}-style`] !== 'none' && px(el[`border-${side}-width`]) > 0);
      for (const v of new Set(sides.map((side) => el[`border-${side}-color`]))) addColor('border', v);
      if (el['background-image']?.includes('gradient(')) gradients.add(el['background-image'], where);

      if (el.hasText) {
        const fam = el['font-family'];
        families.add(fam, where);
        sizes.add(el['font-size'], where);
        weights.add(el['font-weight'], where);
        lineHeights.add(el['line-height'], where);
        letterSpacing.add(el['letter-spacing'], where);
        if (el['text-transform'] !== 'none') transforms.add(el['text-transform'], where);
        textStyles.add([fam.split(',')[0].replace(/["']/g, ''), el['font-size'], el['font-weight'], el['line-height'], el['text-transform']].join(' | '), where);
        if (/^h[1-6]$/.test(el.tag)) headingSizes.add(`${el.tag} ${el['font-size']}`, where);
      }
      for (const side of ['top', 'right', 'bottom', 'left']) {
        const p = px(el[`padding-${side}`]); if (p) padding.add(p, where);
        const m = px(el[`margin-${side}`]); if (m && m > 0) margin.add(m, where);
      }
      for (const k of ['row-gap', 'column-gap']) { const g = px(el[k]); if (g) gaps.add(g, where); }
      const rs = ['top-left', 'top-right', 'bottom-right', 'bottom-left'].map((c) => el[`border-${c}-radius`]);
      if (rs.some((r) => r !== '0px')) radii.add(new Set(rs).size === 1 ? rs[0] : rs.join(' '), where);
      const borderValues = new Set(sides.map((side) => {
        const c = parseColor(el[`border-${side}-color`]);
        return `${el[`border-${side}-width`]} ${el[`border-${side}-style`]} ${c ? toHex(c) : el[`border-${side}-color`]}`;
      }));
      for (const b of borderValues) borders.add(b, where);
      if (el['box-shadow'] && el['box-shadow'] !== 'none') shadows.add(el['box-shadow'], where);
      if (el['max-width'] && el['max-width'] !== 'none') maxWidths.add(el['max-width'], where);
      if (el['transition-duration'] && el['transition-duration'] !== '0s') transitions.add(`${el['transition-property']} ${el['transition-duration']} ${el['transition-timing-function']}`, where);
      if (el['animation-name'] && el['animation-name'] !== 'none') animations.add(`${el['animation-name']} ${el['animation-duration']} ${el['animation-timing-function']}`, where);
    }
  }

  // ---------- color clustering ----------
  const colorList = allColors.list();
  const clusters = [];
  for (const c of colorList) {
    const rgba = parseColor(`rgba(${parseInt(c.value.slice(1, 3), 16)},${parseInt(c.value.slice(3, 5), 16)},${parseInt(c.value.slice(5, 7), 16)},${c.value.length > 7 ? parseInt(c.value.slice(7, 9), 16) / 255 : 1})`);
    const home = clusters.find((k) => deltaE(k.rgba, rgba) <= CLUSTER_DELTA_E);
    if (home) home.members.push({ value: c.value, count: c.count, deltaE: Math.round(deltaE(home.rgba, rgba) * 10) / 10 });
    else clusters.push({ suggested: c.value, rgba, members: [{ value: c.value, count: c.count, deltaE: 0 }] });
  }
  const roleOf = (hex, rgba) => {
    const usedAs = Object.entries(colorUse).filter(([, ctr]) => ctr.map.has(hex)).map(([k, ctr]) => [k, ctr.map.get(hex).count]).sort((a, b) => b[1] - a[1]);
    const { h, s, l } = hsl(rgba);
    const chromatic = s > 0.25 && l > 0.08 && l < 0.92;
    // status colors are only guessed from hue, flagged as such in the report
    if (chromatic && usedAs[0]?.[0] !== 'surface' && ((h < 15 || h > 345) && s > 0.6)) return { role: 'status', guess: 'error-like red, confirm in code' };
    if (chromatic) return { role: 'brand', usedAs: usedAs.map((u) => u[0]) };
    if (usedAs[0]) return { role: usedAs[0][0], usedAs: usedAs.map((u) => u[0]) };
    return { role: 'other' };
  };
  const colorReport = clusters.map((k) => {
    const total = k.members.reduce((n, m) => n + m.count, 0);
    return { suggested: k.suggested, total, ...roleOf(k.suggested, k.rgba), members: k.members };
  });
  // Most used chromatic cluster is "brand", the rest are "accent".
  const chromaticClusters = colorReport.filter((c) => c.role === 'brand').sort((a, b) => b.total - a.total);
  chromaticClusters.slice(1).forEach((c) => (c.role = 'accent'));

  // ---------- type scale ----------
  const sizeList = sizes.list().map((s) => ({ ...s, px: px(s.value) })).filter((s) => s.px).sort((a, b) => a.px - b.px);
  const STEP_NAMES = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl'];
  // Anchor body text at the most frequent size, then keep sizes used at least 3 times as steps.
  const body = [...sizeList].sort((a, b) => b.count - a.count)[0];
  const anchors = sizeList.filter((s) => s.count >= 3 || s === body).map((s) => s.px);
  const steps = [];
  for (const v of anchors) if (!steps.length || v / steps[steps.length - 1] > 1.08) steps.push(v);
  const bodyIdx = steps.findIndex((v) => v >= body.px);
  const offset = 2 - bodyIdx; // body text maps to "md"
  const namedSteps = steps.map((v, i) => ({ name: STEP_NAMES[i + offset] ?? `step${i + offset}`, px: v }));
  const typeMapping = sizeList.map((s) => {
    const nearest = namedSteps.reduce((a, b) => (Math.abs(b.px - s.px) < Math.abs(a.px - s.px) ? b : a));
    const fits = Math.abs(nearest.px - s.px) <= 0.5;
    return { observed: s.value, count: s.count, step: nearest.name, stepValue: nearest.px + 'px', fits, pages: s.pages };
  });

  // ---------- spacing scale ----------
  const spacingAll = new Map();
  for (const ctr of [padding, margin, gaps]) for (const e of ctr.list()) spacingAll.set(e.value, (spacingAll.get(e.value) ?? 0) + e.count);
  const spacingSorted = [...spacingAll.entries()].sort((a, b) => a[0] - b[0]).map(([v, count]) => ({ px: v, count, onGrid4: v % 4 === 0, onGrid8: v % 8 === 0 }));
  const SCALE = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128];
  const spacingSuggested = SCALE.map((v, i) => ({
    name: String(i + 1),
    px: v,
    absorbs: spacingSorted.filter((s) => SCALE.reduce((a, b) => (Math.abs(b - s.px) < Math.abs(a - s.px) ? b : a)) === v).map((s) => `${s.px}px x${s.count}`),
  })).filter((s) => s.absorbs.length);

  // ---------- CSS: media queries, keyframes, transitions ----------
  const cssDir = path.join(RAW, 'css');
  const cssFiles = (await readdir(cssDir).catch(() => [])).filter((f) => f.endsWith('.css'));
  const mediaQueries = new Counter(), keyframes = new Counter(), cssTransitions = new Counter(), cssFontFaces = new Counter(), cssVars = new Counter();
  for (const f of cssFiles) {
    const css = await readFile(path.join(cssDir, f), 'utf8');
    for (const m of css.matchAll(/@media([^{]+)\{/g)) mediaQueries.add(m[1].trim().replace(/\s+/g, ' '), { page: f });
    for (const m of css.matchAll(/@(?:-webkit-)?keyframes\s+([\w-]+)/g)) keyframes.add(m[1], { page: f });
    for (const m of css.matchAll(/(?:^|[;{\s])transition\s*:\s*([^;}]+)/g)) cssTransitions.add(m[1].trim(), { page: f });
    for (const m of css.matchAll(/@font-face\s*\{[^}]*font-family\s*:\s*([^;]+);/g)) cssFontFaces.add(m[1].trim().replace(/["']/g, ''), { page: f });
    for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) cssVars.add(`${m[1]}: ${m[2].trim()}`, { page: f });
  }
  const breakpoints = new Counter();
  for (const mq of mediaQueries.list()) for (const m of mq.value.matchAll(/(min|max)-width\s*:\s*([\d.]+)(px|em|rem)/g)) {
    const v = m[3] === 'px' ? +m[2] : +m[2] * 16;
    breakpoints.add(`${m[1]}-width ${v}px`, null);
    breakpoints.map.get(`${m[1]}-width ${v}px`).count += mq.count - 1;
  }

  let capture = {};
  try { capture = JSON.parse(await readFile(path.join(RAW, 'capture-log.json'), 'utf8')); } catch {}

  // ---------- W3C tokens ----------
  const tok = (value, type, extra = {}) => ({ $value: value, $type: type, ...extra });
  const tokens = {
    $description: `Observed tokens for ohiogolfclubindoor.com, extracted from the rendered public site on ${capture.startedAt ?? 'unknown date'}. Hypotheses only, verify against the theme code.`,
    color: {},
    gradient: {},
    font: { family: {}, size: {}, weight: {}, lineHeight: {}, letterSpacing: {} },
    space: {},
    radius: {},
    border: {},
    shadow: {},
    breakpoint: {},
    motion: { transition: {}, keyframes: {} },
  };
  const roleCounters = {};
  for (const c of colorReport.sort((a, b) => b.total - a.total)) {
    roleCounters[c.role] = (roleCounters[c.role] ?? 0) + 1;
    tokens.color[c.role] ??= {};
    tokens.color[c.role][`${c.role}-${roleCounters[c.role]}`] = tok(c.suggested, 'color', {
      $description: `Used ${c.total}x${c.members.length > 1 ? `, cluster of ${c.members.length} near-duplicates` : ''}${c.guess ? `, ${c.guess}` : ''}`,
      $extensions: { 'ogc.observed': c.members, 'ogc.usedAs': c.usedAs },
    });
  }
  gradients.list().forEach((g, i) => {
    tokens.gradient[`gradient-${i + 1}`] = tok(g.value, 'gradient', { $description: `Used ${g.count}x on ${g.pages.join(', ')}`, $extensions: { 'ogc.examples': g.examples } });
  });
  families.list().forEach((f, i) => (tokens.font.family[`family-${i + 1}`] = tok(f.value.split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')), 'fontFamily', { $description: `Used on ${f.count} text elements` })));
  namedSteps.forEach((s) => (tokens.font.size[s.name] = tok(`${s.px}px`, 'dimension', { $description: `Observed ${sizeList.find((x) => x.px === s.px)?.count ?? 0}x` })));
  weights.list().forEach((w) => (tokens.font.weight[w.value] = tok(+w.value, 'fontWeight', { $description: `Observed ${w.count}x` })));
  lineHeights.list().slice(0, 12).forEach((l, i) => (tokens.font.lineHeight[`lh-${i + 1}`] = tok(l.value, 'dimension', { $description: `Observed ${l.count}x` })));
  letterSpacing.list().filter((l) => l.value !== 'normal').forEach((l, i) => (tokens.font.letterSpacing[`ls-${i + 1}`] = tok(l.value, 'dimension', { $description: `Observed ${l.count}x` })));
  spacingSuggested.forEach((s) => (tokens.space[s.name] = tok(`${s.px}px`, 'dimension', { $description: `Suggested step, absorbs ${s.absorbs.join(', ')}` })));
  radii.list().forEach((r, i) => (tokens.radius[`radius-${i + 1}`] = tok(r.value, 'dimension', { $description: `Observed ${r.count}x` })));
  borders.list().forEach((b, i) => {
    const [width, style, color] = b.value.split(' ');
    tokens.border[`border-${i + 1}`] = tok({ width, style, color }, 'border', { $description: `Observed ${b.count}x` });
  });
  shadows.list().forEach((s, i) => (tokens.shadow[`shadow-${i + 1}`] = tok(s.value, 'shadow', { $description: `Observed ${s.count}x (raw computed value, not split into W3C shadow parts)` })));
  breakpoints.list().sort((a, b) => parseFloat(a.value.split(' ')[1]) - parseFloat(b.value.split(' ')[1])).forEach((b) => (tokens.breakpoint[b.value.replace(/\s+/g, '-')] = tok(b.value.split(' ')[1], 'dimension', { $description: `Appears in ${b.count} media queries` })));
  [...transitions.list(), ...cssTransitions.list()].slice(0, 20).forEach((t, i) => (tokens.motion.transition[`transition-${i + 1}`] = tok(t.value, 'transition', { $description: `Observed ${t.count}x` })));
  keyframes.list().forEach((k) => (tokens.motion.keyframes[k.value] = tok(k.value, 'string', { $description: `Defined in ${k.pages.join(', ')}` })));

  const report = {
    generatedAt: new Date().toISOString(),
    source: { capturedAt: capture.startedAt, pages: widthsByPage, computedFiles: files.length, cssFiles },
    colors: { distinct: colorList.length, clusters: colorReport, clusterThresholdDeltaE: CLUSTER_DELTA_E, byUse: Object.fromEntries(Object.entries(colorUse).map(([k, v]) => [k, v.list()])) },
    gradients: gradients.list(),
    typography: {
      families: families.list(), fontFaceRules: cssFontFaces.list(), loadedFonts: capture.fonts,
      sizes: sizeList, distinctSizes: sizeList.length, proposedScale: namedSteps, mapping: typeMapping,
      weights: weights.list(), lineHeights: lineHeights.list(), letterSpacing: letterSpacing.list(), textTransform: transforms.list(),
      headingSizes: headingSizes.list(), textStyles: textStyles.list(),
    },
    spacing: { padding: padding.list(), margin: margin.list(), gap: gaps.list(), combined: spacingSorted, suggestedScale: spacingSuggested },
    shape: { radii: radii.list(), borders: borders.list(), shadows: shadows.list() },
    layout: { maxWidths: maxWidths.list(), mediaQueries: mediaQueries.list(), breakpoints: breakpoints.list() },
    motion: { computedTransitions: transitions.list(), cssTransitions: cssTransitions.list(), animations: animations.list(), keyframes: keyframes.list() },
    cssCustomProperties: cssVars.list(),
  };

  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, 'tokens.json'), JSON.stringify(tokens, null, 2));
  await writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`colors: ${colorList.length} distinct in ${clusters.length} clusters | gradients: ${gradients.list().length} | font sizes: ${sizeList.length} | families: ${families.list().length} | breakpoints: ${breakpoints.list().length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
