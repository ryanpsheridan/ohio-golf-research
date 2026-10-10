// Builds style-guide.html from tokens/report.json plus the component notes below.
// Usage: node scripts/build-style-guide.mjs

import { readFile, writeFile } from 'node:fs/promises';

const r = JSON.parse(await readFile('tokens/report.json', 'utf8'));
const log = JSON.parse(await readFile('raw/capture-log.json', 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const capturedOn = new Date(log.startedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

// ---------- color ----------
const alphaLabel = (hex) => (hex.length === 9 ? ` at ${Math.round((parseInt(hex.slice(7), 16) / 255) * 100)}%` : '');
const NAMES = {
  '#ffffff': 'White', '#ae1b22': 'Club red (--color-primary)', '#000000': 'Black', '#e5e7eb': 'Gray 200', '#ffffffb3': 'White',
  '#ffffff1a': 'White', '#eab308': 'Star yellow', '#222222': 'Card charcoal', '#d1d5db': 'Gray 300', '#e0474f': 'Light red (fall league only)',
  '#011e41': 'Navy', '#00000080': 'Black', '#374151': 'Gray 700', '#00000099': 'Black', '#ffffff80': 'White', '#4b5563': 'Gray 600',
  '#1f2937': 'Gray 800', '#ffffffe6': 'White', '#ae1b2233': 'Club red', '#9ca3af': 'Gray 400', '#ae1b22b3': 'Club red', '#ae1b2299': 'Club red',
};
const ROLE_ORDER = ['brand', 'accent', 'surface', 'text', 'border', 'other'];
const ROLE_LABEL = { brand: 'Brand', accent: 'Accent', surface: 'Surface', text: 'Text', border: 'Border', other: 'Other' };
const clusters = [...r.colors.clusters].sort((a, b) => b.total - a.total);
const swatch = (hex) => `<span class="chip" style="--c:${hex}"></span>`;
const colorCards = ROLE_ORDER.map((role) => {
  const list = clusters.filter((c) => c.role === role);
  if (!list.length) return '';
  return `<h3>${ROLE_LABEL[role]}</h3><div class="swatches">${list
    .map((c) => {
      const members = c.members.length > 1
        ? `<p class="members">Cluster: ${c.members.map((m) => `${swatch(m.value)}<code>${m.value}</code> ${m.count}x`).join(', ')}</p>`
        : '';
      return `<article class="swatch">
        <div class="swatch-color" style="--c:${c.suggested}"></div>
        <div class="swatch-body">
          <strong>${esc((NAMES[c.suggested] ?? c.suggested) + alphaLabel(c.suggested))}</strong>
          <code>${c.suggested}</code>
          <span class="muted">${c.total} uses${c.usedAs?.length ? ` · as ${c.usedAs.join(', ')}` : ''}</span>
          ${members}
        </div>
      </article>`;
    })
    .join('')}</div>`;
}).join('');

// Colors that appear only inside gradients are not in the computed color counts.
const gradientOnly = ['#0a2a52'];

// ---------- gradients ----------
const isScrim = (g) => !/rgb\((?!0, 0, 0)/.test(g) && !/rgba\((?!0, 0, 0,)/.test(g);
const gradients = r.gradients.map((g) => ({ ...g, kind: isScrim(g.value) ? 'Image scrim' : 'Decorative' }));
const gradientCards = gradients
  .map((g) => `<article class="grad">
    <div class="grad-sample" style="background-image:${esc(g.value)}"></div>
    <div class="swatch-body">
      <strong>${g.kind}</strong>
      <span class="muted">${g.pages.join(', ')} · ${g.count} element${g.count === 1 ? '' : 's'} across widths</span>
      <code class="wrap">${esc(g.value)}</code>
      <span class="muted small">On: <code>${esc(g.examples[0].selector.split(' > ').slice(-2).join(' > '))}</code></span>
    </div>
  </article>`)
  .join('');

// ---------- typography ----------
const styleBySize = {};
for (const s of r.typography.textStyles) {
  const [family, size, weight] = s.value.split(' | ');
  styleBySize[size] ??= {};
  styleBySize[size][family] = (styleBySize[size][family] ?? 0) + s.count;
  styleBySize[size].weights ??= {};
  styleBySize[size].weights[weight] = (styleBySize[size].weights[weight] ?? 0) + s.count;
}
const dominant = (o) => Object.entries(o).filter(([k]) => k !== 'weights').sort((a, b) => b[1] - a[1])[0][0];
const topWeight = (o) => Object.entries(o.weights).sort((a, b) => b[1] - a[1])[0][0];
const typeRows = r.typography.mapping
  .slice()
  .reverse()
  .map((m) => {
    const fam = dominant(styleBySize[m.observed]);
    const w = topWeight(styleBySize[m.observed]);
    const sample = parseFloat(m.observed) >= 60 ? 'Same game.' : parseFloat(m.observed) >= 24 ? 'Same game. Different season.' : 'Private hitting bays with TrackMan 4';
    return `<div class="type-row${m.fits ? '' : ' off'}">
      <div class="type-meta">
        <strong>${m.fits ? `text-${m.step}` : 'Off scale'}</strong>
        <span>${m.observed} · ${fam} ${w} · ${m.count}x</span>
        ${m.fits ? '' : `<span class="flag">Nearest step: ${m.step} (${m.stepValue})</span>`}
      </div>
      <div class="type-sample" style="font-family:'${fam}',sans-serif;font-size:min(${m.observed},13vw);font-weight:${w}">${sample}</div>
    </div>`;
  })
  .join('');
const listCounts = (arr, n = 99) => arr.slice(0, n).map((x) => `<span class="pill">${esc(x.value)} <em>${x.count}</em></span>`).join('');

// ---------- spacing, shape ----------
const spacingRows = r.spacing.suggestedScale
  .map((s) => `<div class="space-row"><span class="space-name">${s.px}px</span><span class="space-bar" style="width:${Math.min(s.px, 128)}px"></span><span class="muted small">absorbs ${esc(s.absorbs.join(', '))}</span></div>`)
  .join('');
const RADIUS_USE = { '4px': 'Inputs', '8px': 'Buttons, checkbox cards', '10px': 'Fall league only', '12px': 'Offering and review cards', '16px': 'Cards, media, header', '28px': 'Home league card glow', '9999px': 'Pills, badges, dots' };
const radiusCards = r.shape.radii
  .map((x) => `<div class="radius"><div class="radius-box" style="border-radius:${x.value}"></div><strong>${x.value === '9999px' ? 'Full' : x.value}</strong><span class="muted small">${RADIUS_USE[x.value] ?? ''} · ${x.count}x</span></div>`)
  .join('');
const SHADOW_NAME = (v) => (v.includes('20px 25px') && !v.includes('174, 27, 34') ? 'shadow-xl' : v.includes('4px 6px') ? 'shadow-md' : v.includes('1px 2px') ? 'shadow-sm' : v.includes('174, 27, 34') ? 'Ring 2 red + shadow-xl' : 'Custom deep shadow');
const shadowCards = r.shape.shadows
  .map((x) => `<div class="shadow"><div class="shadow-box" style="box-shadow:${esc(x.value)}"></div><strong>${SHADOW_NAME(x.value)}</strong><span class="muted small">${x.count}x</span></div>`)
  .join('');
const borderRows = r.shape.borders.map((b) => `<span class="pill">${swatch(b.value.split(' ')[2])}${esc(b.value)} <em>${b.count}</em></span>`).join('');

// ---------- components ----------
const C = (title, img, pages, notes, unconfirmed) => ({ title, img, pages, notes, unconfirmed });
const components = [
  C('Header and navigation', ['header-desktop', 'mobile-menu'], 'All pages', [
    'A floating white bar, 576px max width, 16px from the top, radius 16px, shadow-sm.',
    'Logo, then the phone number in navy #011e41 (16px bold, hidden below 768px), then a hamburger. Desktop uses the hamburger too.',
    'The menu panel lists Fall League, Lessons & Fittings, Memberships, Events, Bay Rentals, Member Login, Customer Login, the phone number and a red Contact button.',
    'The phone link turns red on hover. The hamburger focus outline is transparent, so no focus ring is visible.',
  ], 'Desktop menu panel layout. The menu was only opened at 390.'),
  C('Badge and hero', ['hero-home', 'events-hero', 'league-hero'], 'Home, events, contact, fall league, Carl’s Place', [
    'Badge: red pill, Inter 12px bold uppercase, 8 by 16px padding, 32px tall. The home and fall league versions add a pulsing dot.',
    'Hero A (home): centered on black, Montserrat 72px, red underline bar, primary plus outline buttons.',
    'Hero B (events, contact, Carl’s Place): full-bleed photo with a dark overlay, centered, one primary button.',
    'Hero C (fall league): photo with a left gradient, left aligned, 104px uppercase title.',
  ], 'Whether these are one component with variants or separate markup per page.'),
  C('Buttons', ['states/cta-primary-rest.png', 'states/cta-primary-hover.png', 'states/cta-outline-rest.png', 'states/cta-outline-hover.png'], 'All pages', [
    'Primary: red fill, Inter 16px medium, 12 by 24px padding, 48px tall, radius 8px.',
    'Large: 18px text, 16 by 32px padding, 56px tall. Wide: 12 by 32px padding (Member Portal only). Outline: 1px white border.',
    'Hover inverts the primary to white with red text and a red border. Outline hover turns the text and border red. Focus shows a 2px red ring. The transition is 150ms.',
    '“Contact Us Today” has no hover change and a white focus ring.',
  ], 'Disabled and pressed states (none present). The Send Message hover.'),
  C('Image link tiles', ['image-tiles', 'events-bar'], 'Home', [
    'Photo with a 50% black overlay and a centered Montserrat 36px label with a text shadow, radius 16px.',
    'Hover: the image scales to 105% over 500ms and the overlay lightens to 30%.',
  ], ''),
  C('Feature and offering cards', ['offering-cards', 'event-cards', 'why-choose-cards'], 'Home, events, Carl’s Place', [
    'Home and Carl’s Place: #222222, radius 12px, 32px padding, centered, shadow-md that rises to shadow-lg on hover.',
    'Events: #222222, radius 16px, 1px white at 10% border, left aligned, an outline icon, lighter gray body text.',
  ], ''),
  C('Membership tiers and member rates', ['membership-tiers', 'member-rates'], 'Home', [
    'Tier cards: white on #121212, radius 16px, shadow-xl, Montserrat price at 30px, red check list.',
    'Most Popular adds a 2px red ring and a red pill tag. Hover turns the border red.',
    'Rates: a white panel at 672px, two columns of label and red price rows with gray 200 dividers.',
  ], ''),
  C('Lesson and fitting block', ['lessons-fitting', 'bay-rentals'], 'Home', [
    'Two-column text and image row on #121212: Montserrat 36px heading, paragraph, red check list, one primary button.',
    'Bay Rentals is the same layout mirrored, on black.',
  ], ''),
  C('Reviews', ['reviews', 'testimonials'], 'Home, Carl’s Place', [
    'Home: black cards at a fixed 350px width, radius 12px, name, yellow stars, truncated text, date. Laid out 3 then 2.',
    'Carl’s Place: a different component. #222222 cards, italic quote, red attribution.',
  ], 'Review source (it loads late, so it looks dynamic). Truncation rule. Whether the Carl’s Place names are placeholders.'),
  C('Team member card', ['team-card'], 'Team', [
    'Square photo, radius 16px, black gradient scrim. Then the name in Montserrat 20px, role in bold, email and bio at 14px.',
  ], ''),
  C('Fall league modules', ['league-card', 'season-timeline', 'how-it-works', 'league-cta'], 'Home, fall league', [
    'A stat strip, a color-coded season timeline, numbered navy gradient panels with #e0474f eyebrows, a bracket and a points table.',
    'Most of the gradients and one-off sizes (radius 10px, 18px margins) live here.',
  ], 'Whether this page is a one-off campaign or its parts should become shared components.'),
  C('Contact block, form and footer', ['contact-block', 'footer'], 'Contact (form), all pages (footer)', [
    'Contact: red uppercase 12px labels (Visit, Call, Email) over white text, and a red “Get directions” link.',
    'Form: white card, radius 16px. Labels are gray 700 16px. Inputs are 50px tall with a gray 300 border and radius 4px. Two checkbox cards at radius 8px.',
    'Footer: #0a0a0a, four columns, red Montserrat 18px titles, 14px white links that turn red on hover, a white at 10% divider.',
  ], 'Form focus, error, success and required states (the form was not used).'),
];
const imgSrc = (i) => (i.includes('/') ? `screenshots/${i}` : `screenshots/components/${i}.jpg`);
const componentCards = components
  .map((c) => `<article class="comp" id="c-${c.title.toLowerCase().replace(/[^a-z]+/g, '-')}">
    <h3>${esc(c.title)}</h3>
    <p class="muted small">${esc(c.pages)}</p>
    <div class="comp-imgs${c.img.length > 2 ? ' many' : ''}">${c.img.map((i) => `<a href="${imgSrc(i)}" target="_blank" rel="noopener"><img loading="lazy" src="${imgSrc(i)}" alt="${esc(c.title)} screenshot"></a>`).join('')}</div>
    <ul>${c.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
    ${c.unconfirmed ? `<p class="unconfirmed"><strong>Not confirmed:</strong> ${esc(c.unconfirmed)}</p>` : ''}
  </article>`)
  .join('');

// ---------- page ----------
const stats = [
  [r.colors.distinct, 'distinct colors', `${r.colors.clusters.length} after clustering`],
  [r.typography.distinctSizes, 'font sizes', `${r.typography.mapping.filter((m) => !m.fits).length} off the Tailwind scale`],
  [gradients.length, 'gradients', `${gradients.filter((g) => g.kind === 'Decorative').length} decorative, ${gradients.filter((g) => g.kind !== 'Decorative').length} image scrims`],
  [r.typography.families.length, 'font families', 'Montserrat and Inter'],
];
const nav = [['overview', 'Overview'], ['color', 'Color'], ['gradients', 'Gradients'], ['type', 'Type'], ['spacing', 'Spacing'], ['shape', 'Shape'], ['layout', 'Layout'], ['motion', 'Motion'], ['components', 'Components'], ['patterns', 'Patterns'], ['issues', 'Inconsistencies'], ['questions', 'Open questions']];

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ohio Golf Club Style Guide</title>
<meta name="description" content="Observed design tokens, components and patterns from the public Ohio Golf Club site.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=Montserrat:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  :root {
    color-scheme: light;
    --bg: #f7f8fa; --surface: #ffffff; --surface-2: #eef0f4; --on: #1b1c1f; --muted: #5c5f66;
    --outline: #d6d9e0; --accent: #3a5a8c; --accent-soft: #e3eaf6; --warn-soft: #fdf1e6; --warn: #8a4b0f;
    --r-lg: 20px; --r-md: 14px; --r-sm: 10px;
    --font: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; scroll-padding-top: 64px; }
  body { margin: 0; background: var(--bg); color: var(--on); font: 16px/1.55 var(--font); -webkit-text-size-adjust: 100%; }
  img { max-width: 100%; display: block; }
  code { font-family: var(--mono); font-size: 0.82em; background: var(--surface-2); padding: 1px 6px; border-radius: 6px; }
  code.wrap { display: block; white-space: normal; word-break: break-word; padding: 6px 8px; margin: 6px 0; }
  a { color: var(--accent); }
  .muted { color: var(--muted); }
  .small { font-size: 0.85rem; }
  header.top { position: sticky; top: 0; z-index: 10; background: rgba(247,248,250,0.92); backdrop-filter: blur(10px); border-bottom: 1px solid var(--outline); }
  header.top nav { display: flex; gap: 6px; overflow-x: auto; padding: 10px 16px; scrollbar-width: none; }
  header.top nav::-webkit-scrollbar { display: none; }
  header.top a { flex: none; text-decoration: none; color: var(--on); font-size: 0.875rem; padding: 6px 14px; border-radius: 999px; border: 1px solid var(--outline); background: var(--surface); }
  header.top a:hover { background: var(--accent-soft); border-color: var(--accent-soft); }
  main { max-width: 1120px; margin: 0 auto; padding: 0 16px 64px; }
  section { padding-top: 40px; }
  h1 { font-size: clamp(1.75rem, 6vw, 2.5rem); line-height: 1.15; margin: 32px 0 8px; letter-spacing: -0.01em; }
  h2 { font-size: 1.5rem; margin: 0 0 6px; }
  h3 { font-size: 1.1rem; margin: 28px 0 12px; }
  .lede { font-size: 1.05rem; color: var(--muted); max-width: 680px; }
  .card { background: var(--surface); border-radius: var(--r-lg); padding: 20px; border: 1px solid var(--outline); }
  .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 20px; }
  .stat { background: var(--surface); border: 1px solid var(--outline); border-radius: var(--r-md); padding: 16px; }
  .stat b { display: block; font-size: 2rem; line-height: 1; }
  .stat span { display: block; font-weight: 600; margin-top: 6px; }
  .stat small { color: var(--muted); }
  .swatches { display: grid; grid-template-columns: 1fr; gap: 12px; }
  .swatch, .grad { display: flex; background: var(--surface); border: 1px solid var(--outline); border-radius: var(--r-md); overflow: hidden; }
  .swatch-color, .grad-sample, .chip { background-image: linear-gradient(var(--c), var(--c)), repeating-conic-gradient(#d9dce2 0 25%, #fff 0 50%); background-size: auto, 12px 12px; }
  .swatch-color { width: 84px; flex: none; border-right: 1px solid var(--outline); }
  .grad { flex-direction: column; }
  .grad-sample { height: 96px; background-color: #8a8f99; border-bottom: 1px solid var(--outline); }
  .swatch-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .members { margin: 6px 0 0; font-size: 0.82rem; color: var(--muted); }
  .chip { display: inline-block; width: 12px; height: 12px; border-radius: 4px; border: 1px solid var(--outline); vertical-align: -1px; margin-right: 4px; }
  .note { background: var(--accent-soft); border-radius: var(--r-md); padding: 14px 16px; margin: 16px 0; }
  .fonts { display: grid; gap: 12px; }
  .font-card { background: #0b0b0c; color: #fff; border-radius: var(--r-md); padding: 20px; }
  .font-card .big { font-size: 2.2rem; line-height: 1.1; margin: 6px 0; }
  .font-card .muted { color: #b9bcc4; }
  .type-row { background: var(--surface); border: 1px solid var(--outline); border-radius: var(--r-md); padding: 14px 16px; margin-bottom: 10px; overflow: hidden; }
  .type-row.off { background: var(--warn-soft); border-color: #f1d8bd; }
  .type-meta { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline; font-size: 0.85rem; color: var(--muted); margin-bottom: 6px; }
  .type-meta strong { color: var(--on); font-size: 0.95rem; }
  .flag { color: var(--warn); }
  .type-sample { line-height: 1.1; overflow-wrap: anywhere; }
  .pills { display: flex; flex-wrap: wrap; gap: 6px; }
  .pill { background: var(--surface); border: 1px solid var(--outline); border-radius: 999px; padding: 3px 10px; font-size: 0.82rem; font-family: var(--mono); }
  .pill em { font-style: normal; color: var(--muted); margin-left: 4px; }
  .space-row { display: grid; grid-template-columns: 52px auto; gap: 4px 12px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--outline); }
  .space-row .small { grid-column: 1 / -1; }
  .space-name { font-family: var(--mono); font-size: 0.85rem; }
  .space-bar { height: 14px; background: var(--accent); border-radius: 4px; }
  .grid-3 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .radius, .shadow { background: var(--surface); border: 1px solid var(--outline); border-radius: var(--r-md); padding: 16px; display: flex; flex-direction: column; gap: 4px; }
  .radius-box { width: 72px; height: 72px; background: var(--accent-soft); border: 2px solid var(--accent); margin-bottom: 8px; }
  .shadow { background: var(--surface-2); }
  .shadow-box { height: 72px; background: #fff; border-radius: 12px; margin: 8px 8px 16px; }
  table { width: 100%; border-collapse: collapse; background: var(--surface); border-radius: var(--r-md); overflow: hidden; font-size: 0.9rem; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--outline); vertical-align: top; }
  th { background: var(--surface-2); font-weight: 600; }
  .table-wrap { overflow-x: auto; border: 1px solid var(--outline); border-radius: var(--r-md); }
  .comps { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .comp { background: var(--surface); border: 1px solid var(--outline); border-radius: var(--r-lg); padding: 18px; }
  .comp h3 { margin: 0 0 2px; }
  .comp-imgs { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; margin: 12px 0; }
  .comp, .comp-imgs a { min-width: 0; }
  .comp-imgs a:only-child img { max-width: 340px; }
  .comp-imgs img { border-radius: var(--r-sm); border: 1px solid var(--outline); background: #000; }
  .comp ul { margin: 0; padding-left: 20px; }
  .comp li { margin-bottom: 4px; }
  .unconfirmed { background: var(--warn-soft); color: var(--warn); border-radius: var(--r-sm); padding: 10px 12px; margin: 12px 0 0; font-size: 0.9rem; }
  ol.issues { padding-left: 22px; }
  ol.issues li { margin-bottom: 12px; }
  footer { text-align: center; color: var(--muted); font-size: 0.85rem; padding: 32px 16px; }
  @media (min-width: 720px) {
    main { padding: 0 32px 80px; }
    .stats { grid-template-columns: repeat(4, 1fr); }
    .swatches { grid-template-columns: repeat(2, 1fr); }
    .grid-3 { grid-template-columns: repeat(4, 1fr); }
    .fonts { grid-template-columns: 1fr 1fr; }
    .comp-imgs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .space-row { grid-template-columns: 52px 140px 1fr; }
    .space-row .small { grid-column: auto; }
  }
  @media (min-width: 1000px) {
    .swatches { grid-template-columns: repeat(3, 1fr); }
    .comps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
</style>
</head>
<body>
<header class="top"><nav aria-label="Sections">${nav.map(([id, label]) => `<a href="#${id}">${label}</a>`).join('')}</nav></header>
<main>
<section id="overview">
  <h1>Ohio Golf Club style guide</h1>
  <p class="lede">What the public site at ohiogolfclubindoor.com renders today, captured ${capturedOn} at 390, 768 and 1440 px. These are observations, not decisions. Every value is a hypothesis to check against the theme code.</p>
  <div class="stats">${stats.map(([n, l, s]) => `<div class="stat"><b>${n}</b><span>${l}</span><small>${s}</small></div>`).join('')}</div>
  <div class="note">The site is built with Next.js and Tailwind CSS. Most sizes, grays and shadows are Tailwind defaults. Only one theme variable exists, <code>--color-primary: #ae1b22</code>. The other brand colors are written as one-off values such as <code>text-[#011E41]</code> and <code>bg-[#222]</code>.</div>
  <p class="small muted">Pages: home, team, events, contact-us, fall-league, carls-place. Privacy and terms returned 404. Full screenshots are in <code>screenshots/</code>, and the full audit is in <code>audit.md</code>.</p>
</section>

<section id="color">
  <h2>Color</h2>
  <p class="muted">Usage counts every visible element that uses the color: text color for elements with text, plus backgrounds and borders. Colors within a small visual difference of each other (Delta E ${r.colors.clusterThresholdDeltaE}) are grouped as a cluster. The original values are kept. Transparent colors are shown over a checkerboard.</p>
  ${colorCards}
  <p class="small muted">Also seen only inside gradients: ${gradientOnly.map((h) => `${swatch(h)}<code>${h}</code>`).join(' ')} (navy panel start color on the fall league page).</p>
</section>

<section id="gradients">
  <h2>Gradients</h2>
  <p class="muted">${gradients.length} distinct gradients. The ${gradients.filter((g) => g.kind === 'Decorative').length} decorative ones sit on the home league card and the fall league panels. Flattening those does most of the work toward a cleaner look. The ${gradients.filter((g) => g.kind !== 'Decorative').length} black image scrims keep text readable over photos and could become one overlay token.</p>
  <div class="swatches">${gradientCards}</div>
</section>

<section id="type">
  <h2>Typography</h2>
  <div class="fonts">
    <div class="font-card" style="font-family:'Montserrat',sans-serif"><span class="muted" style="font-family:var(--font)">Headings · Montserrat · 600, 700, 800 loaded · ${r.typography.families.find((f) => f.value.startsWith('Montserrat'))?.count ?? 0} text elements</span><div class="big" style="font-weight:700">Same Game. Different Season.</div><div>Aa Bb Cc 0123456789</div></div>
    <div class="font-card" style="font-family:'Inter',sans-serif"><span class="muted" style="font-family:var(--font)">Body and UI · Inter (variable 100 to 900) · ${r.typography.families.find((f) => f.value.startsWith('Inter'))?.count ?? 0} text elements</span><div class="big" style="font-weight:500">Book a private hitting bay</div><div>Aa Bb Cc 0123456789</div></div>
  </div>
  <h3>Observed sizes mapped to Tailwind steps</h3>
  <p class="muted small">Each row shows the size in its most common font and weight. Highlighted rows are off the scale.</p>
  ${typeRows}
  <h3>Weights</h3><div class="pills">${listCounts(r.typography.weights)}</div>
  <h3>Line heights (top 15)</h3><div class="pills">${listCounts(r.typography.lineHeights, 15)}</div>
  <h3>Letter spacing</h3><p class="muted small">${r.typography.letterSpacing.length} distinct values, most from one-off tracking on the fall league page.</p><div class="pills">${listCounts(r.typography.letterSpacing, 14)}</div>
  <h3>Text transform</h3><p class="muted">Uppercase on ${r.typography.textTransform[0]?.count ?? 0} elements: badges, eyebrows, contact labels, stat labels and the fall league headings.</p>
  <h3>Headings by level</h3><div class="pills">${listCounts(r.typography.headingSizes, 20)}</div>
</section>

<section id="spacing">
  <h2>Spacing</h2>
  <p class="muted">Padding, margin and gap values are mapped to a suggested 4px based scale. Nearly every value already matches Tailwind's spacing steps.</p>
  ${spacingRows}
  <p class="muted small">Not mapped (more than 25% from any step, mostly margins computed from auto centering): ${esc(r.spacing.unmapped.join(', '))}.</p>
  <div class="note">Section rhythm is consistent: 64px top and bottom on mobile, 96px from 768px up (<code>py-16 md:py-24</code>).</div>
</section>

<section id="shape">
  <h2>Shape and depth</h2>
  <h3>Corner radius</h3><div class="grid-3">${radiusCards}</div>
  <h3>Shadows</h3><div class="grid-3">${shadowCards}</div>
  <h3>Borders</h3><div class="pills">${borderRows}</div>
</section>

<section id="layout">
  <h2>Breakpoints and layout</h2>
  <div class="table-wrap"><table>
    <tr><th>Breakpoint</th><th>What changes</th></tr>
    <tr><td>Under 640</td><td>Single column. Container side padding 16px. Phone number moves into the menu. Hero heading 36px.</td></tr>
    <tr><td>640 (sm)</td><td>Container side padding 24px.</td></tr>
    <tr><td>768 (md)</td><td>Phone number shows in the header. Section padding 64px to 96px. Two-column grids start. Hero heading steps up.</td></tr>
    <tr><td>1024 (lg)</td><td>Container side padding 32px. Three and four-column card grids.</td></tr>
    <tr><td>1280, 1536</td><td>Present in the CSS. No layout change was visible at the captured widths.</td></tr>
  </table></div>
  <p class="muted small">Container max width 1440px (90rem). Text blocks are capped at 672 or 768px, card grids at 1152px, and the header at 576px.</p>
</section>

<section id="motion">
  <h2>Motion</h2>
  <div class="table-wrap"><table>
    <tr><th>Use</th><th>Value</th><th>Count</th></tr>
    ${r.motion.computedTransitions.slice(0, 7).map((t) => `<tr><td>${/opacity, transform 0.6s/.test(t.value) ? 'Fade in on scroll' : /transform 0.5s/.test(t.value) ? 'Image zoom on tile hover' : /color, background/.test(t.value) ? 'Button and link color change' : /box-shadow/.test(t.value) ? 'Card shadow on hover' : /^all/.test(t.value) ? 'General hover' : 'Other'}</td><td><code>${esc(t.value)}</code></td><td>${t.count}</td></tr>`).join('')}
  </table></div>
  <p class="muted small">Keyframes in the CSS: ${r.motion.keyframes.map((k) => `<code>${k.value}</code>`).join(', ')}. The <code>ping</code> animation drives the pulsing dot in the league badges.</p>
</section>

<section id="components">
  <h2>Components</h2>
  <p class="muted">Tap a screenshot to open it full size.</p>
  <div class="comps">${componentCards}</div>
</section>

<section id="patterns">
  <h2>Repeated patterns</h2>
  <div class="card"><ol>
    <li><strong>Section intro.</strong> A centered Montserrat heading (36 to 48px) and an 18px paragraph, then the content, then one centered red button.</li>
    <li><strong>Alternating rows.</strong> Text and photo side by side, mirrored on the next row. Each row has a heading, a paragraph, an optional check list and one button.</li>
    <li><strong>Hero recipe.</strong> Red pill badge, big heading, paragraph, one primary button. Only the home hero adds a secondary outline button.</li>
    <li><strong>Photo with overlay.</strong> A black overlay or gradient behind white text, for heroes, tiles, team photos and the closing banner.</li>
    <li><strong>Closing banner.</strong> A full-bleed photo with a centered heading and a large button, just before the footer.</li>
    <li><strong>One CTA per section.</strong> The secondary path is usually a text link, not a second button.</li>
    <li><strong>Background rhythm.</strong> Black and #121212 sections alternate. Cards use #222222 on dark, or white on #121212 for pricing.</li>
    <li><strong>Fade in on scroll.</strong> Most blocks fade and rise over 600ms as they enter the viewport.</li>
  </ol></div>
</section>

<section id="issues">
  <h2>Inconsistencies</h2>
  <p class="muted">Ranked by how much they matter for building shared components.</p>
  <div class="card"><ol class="issues">
    <li><strong>Colors bypass the theme.</strong> Only the red is a variable. Navy, the near blacks, the card charcoal, the light red and the star yellow are written inline, so they need names before they can become tokens.</li>
    <li><strong>Five near-black surfaces:</strong> #000000, #0a0a0a, #121212, #1a1a1a and #222222. These could be three: page, raised section and card.</li>
    <li><strong>Buttons that look alike but aren't the same.</strong> There are three filled sizes (one used only once), and one CTA has no hover and a different focus ring. Suggested: primary, outline and text variants, in medium (48px) and large (56px).</li>
    <li><strong>Four card styles that look alike.</strong> Offering (12px, no border, centered), event (16px, bordered, left aligned), review (black, 12px) and testimonial (#222, italic). These could be one card with options.</li>
    <li><strong>Seven corner radii:</strong> 4, 8, 10, 12, 16 and 28px, plus full. Suggested: 4 for inputs, 8 for controls, 12 and 16 for cards, full for pills.</li>
    <li><strong>Twenty font sizes, eight of them off the Tailwind scale.</strong> Letter spacing has ${r.typography.letterSpacing.length} values.</li>
    <li><strong>Headings skip levels.</strong> Home, team and events go from h1 to h3. This affects search, which is in scope, and the heading component.</li>
    <li><strong>Two reds.</strong> #e0474f appears only on the fall league page, alongside the brand red and four transparent versions of it.</li>
    <li><strong>Decorative gradients</strong> are concentrated on two surfaces. They're easy to flatten.</li>
    <li><strong>Uppercase is applied ad hoc.</strong> It should become a named text style (eyebrow or label).</li>
  </ol></div>
</section>

<section id="questions">
  <h2>Open questions</h2>
  <div class="card"><ul>
    <li>Where do the privacy and terms pages live? Both return 404.</li>
    <li>Is the fall league page a one-off campaign, or should its timeline, stat strip and panels become shared components?</li>
    <li>Do the theme files define the navy, charcoal and light red anywhere, or are they only inline values?</li>
    <li>What are the form focus, error and success states? They weren't tested, to avoid submitting the form.</li>
    <li>Where do the home reviews come from, and how are they truncated?</li>
    <li>Are the Carl’s Place testimonials real customer quotes?</li>
    <li>The home Instagram section rendered as empty space in the capture. Does an embed load there in a real browser?</li>
    <li>Is the hamburger-only navigation on desktop intentional?</li>
  </ul></div>
</section>
</main>
<footer>Research capture, ${capturedOn}. Values come from the rendered site and still need to be checked against the code.</footer>
</body>
</html>
`;
await writeFile('style-guide.html', html);
console.log(`style-guide.html written (${(html.length / 1024).toFixed(0)} KB)`);
