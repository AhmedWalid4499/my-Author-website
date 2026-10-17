import { parse } from 'node-html-parser';
import { readFileSync, existsSync, readdirSync } from 'fs';

import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const BASE = 'https://ahmedwalid4499.github.io/my-Author-website';
const PAGES_PREFIX = '/my-Author-website/';

const problems = [];
const note = (file, kind, msg) => problems.push({ file, kind, msg });

// aoi-shiori.html is a bare redirect stub for a URL that was published
// before the page was renamed; it has no shell to validate.
const REDIRECTS = new Set(['aoi-shiori.html']);
const htmlFiles = readdirSync(ROOT)
  .filter((f) => f.endsWith('.html') && !REDIRECTS.has(f))
  .sort();

// Class vocabulary defined in the stylesheet.
const cssText = readFileSync(path.join(ROOT, 'assets/css/site.css'), 'utf8');
const definedClasses = new Set();
for (const m of cssText.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) definedClasses.add(m[1]);

// Resolve a page-relative reference to a file on disk.
function resolveRef(file, ref) {
  if (!ref) return null;
  if (/^(https?:|mailto:|tel:|data:|#|javascript:)/i.test(ref)) return null;
  const clean = ref.split('#')[0].split('?')[0];
  if (!clean) return null;
  if (clean.startsWith('/')) {
    // Only 404.html is allowed absolute paths, and they carry the Pages prefix.
    if (!clean.startsWith(PAGES_PREFIX)) return { abs: null, bad: true, clean };
    return { abs: path.join(ROOT, clean.slice(PAGES_PREFIX.length)), bad: false, clean };
  }
  return { abs: path.join(ROOT, clean), bad: false, clean };
}

for (const file of htmlFiles) {
  const src = readFileSync(path.join(ROOT, file), 'utf8');
  const doc = parse(src, { comment: false });
  const is404 = file === '404.html';

  /* ---- headings ---- */
  const h1s = doc.querySelectorAll('h1');
  if (h1s.length !== 1) note(file, 'headings', `${h1s.length} <h1> elements (expected exactly 1)`);

  let last = 0;
  for (const h of doc.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
    const lvl = Number(h.tagName[1]);
    if (last && lvl > last + 1) {
      note(file, 'headings', `h${last} → h${lvl} skips a level near "${h.text.trim().slice(0, 45)}"`);
    }
    last = lvl;
  }

  /* ---- duplicate ids ---- */
  const seen = new Map();
  for (const el of doc.querySelectorAll('[id]')) {
    const id = el.getAttribute('id');
    seen.set(id, (seen.get(id) || 0) + 1);
  }
  for (const [id, n] of seen) if (n > 1) note(file, 'a11y', `duplicate id "${id}" (${n}×)`);

  /* ---- images ---- */
  for (const img of doc.querySelectorAll('img')) {
    const s = img.getAttribute('src') || '(no src)';
    if (img.getAttribute('alt') === undefined) note(file, 'a11y', `<img src="${s}"> has no alt attribute`);
    if (!img.getAttribute('width') || !img.getAttribute('height')) {
      note(file, 'cls', `<img src="${s}"> missing width/height`);
    }
  }

  /* ---- links & assets exist ---- */
  const refs = [];
  for (const el of doc.querySelectorAll('[href],[src],[srcset],[content]')) {
    const tag = el.tagName;
    for (const attr of ['href', 'src']) {
      const v = el.getAttribute(attr);
      if (v) refs.push({ el, tag, attr, v });
    }
    const ss = el.getAttribute('srcset');
    if (ss) {
      for (const part of ss.split(',')) {
        const u = part.trim().split(/\s+/)[0];
        if (u) refs.push({ el, tag, attr: 'srcset', v: u });
      }
    }
  }

  for (const { el, tag, attr, v } of refs) {
    const r = resolveRef(file, v);
    if (!r) continue;
    if (r.bad) { note(file, 'path', `${tag}[${attr}] absolute path outside the Pages sub-path: ${v}`); continue; }
    if (!is404 && v.startsWith('/')) note(file, 'path', `${tag}[${attr}] leading-slash path "${v}" breaks on the GitHub Pages sub-path`);
    if (is404 && !v.startsWith('/') && !/^(https?:|mailto:|tel:|data:|#)/i.test(v)) {
      note(file, 'path', `404.html ${tag}[${attr}] relative path "${v}" — must be root-absolute`);
    }
    if (r.abs && !existsSync(r.abs)) note(file, 'missing', `${tag}[${attr}] → ${v} (no such file)`);
  }

  /* ---- external links ---- */
  for (const a of doc.querySelectorAll('a[target="_blank"]')) {
    const rel = (a.getAttribute('rel') || '').toLowerCase();
    if (!rel.includes('noopener')) note(file, 'security', `target=_blank without rel=noopener → ${a.getAttribute('href')}`);
  }

  /* ---- inline styles ---- */
  if (doc.querySelectorAll('style').length) note(file, 'style', 'page contains a <style> block');
  for (const el of doc.querySelectorAll('[style]')) {
    note(file, 'style', `inline style= on <${el.tagName.toLowerCase()} class="${el.getAttribute('class') || ''}">`);
  }

  /* ---- unknown classes ---- */
  const unknown = new Set();
  for (const el of doc.querySelectorAll('[class]')) {
    for (const c of el.getAttribute('class').split(/\s+/)) {
      if (c && !definedClasses.has(c)) unknown.add(c);
    }
  }
  if (unknown.size) note(file, 'css', `class(es) not defined in site.css: ${[...unknown].join(', ')}`);

  /* ---- head metadata ---- */
  const need = {
    title: doc.querySelector('title'),
    description: doc.querySelector('meta[name="description"]'),
    canonical: doc.querySelector('link[rel="canonical"]'),
    'og:title': doc.querySelector('meta[property="og:title"]'),
    'og:description': doc.querySelector('meta[property="og:description"]'),
    'og:image': doc.querySelector('meta[property="og:image"]'),
    'og:url': doc.querySelector('meta[property="og:url"]'),
    'twitter:card': doc.querySelector('meta[name="twitter:card"]'),
    viewport: doc.querySelector('meta[name="viewport"]'),
  };
  for (const [k, v] of Object.entries(need)) {
    if (is404 && (k === 'canonical' || k.startsWith('og:') || k.startsWith('twitter'))) continue;
    if (!v) note(file, 'seo', `missing ${k}`);
  }

  const canon = doc.querySelector('link[rel="canonical"]');
  if (canon) {
    const href = canon.getAttribute('href') || '';
    const expect = file === 'index.html' ? BASE + '/' : `${BASE}/${file}`;
    if (href !== expect) note(file, 'seo', `canonical is "${href}", expected "${expect}"`);
  }

  const ogImg = doc.querySelector('meta[property="og:image"]');
  if (ogImg) {
    const u = ogImg.getAttribute('content') || '';
    if (!u.startsWith('http')) note(file, 'seo', `og:image must be an absolute URL, got "${u}"`);
    else {
      const rel = u.replace(BASE + '/', '');
      if (!existsSync(path.join(ROOT, rel))) note(file, 'missing', `og:image → ${u} (no such file)`);
    }
  }

  const desc = doc.querySelector('meta[name="description"]');
  if (desc) {
    const len = (desc.getAttribute('content') || '').length;
    if (len < 70 || len > 175) note(file, 'seo', `meta description is ${len} chars (aim for 70–175)`);
  }

  const titleLen = need.title ? need.title.text.length : 0;
  if (titleLen > 65) note(file, 'seo', `<title> is ${titleLen} chars (search results truncate past ~60)`);

  /* ---- shell fidelity ---- */
  if (!doc.querySelector('.skip-link')) note(file, 'shell', 'missing skip link');
  if (!doc.querySelector('header.site-header')) note(file, 'shell', 'missing .site-header');
  if (!doc.querySelector('footer.site-footer')) note(file, 'shell', 'missing .site-footer');
  if (!doc.querySelector('main#main')) note(file, 'shell', 'missing <main id="main">');
  if (!src.includes("classList.add('js')")) note(file, 'shell', 'missing the inline js-class script');
  // src carries a ?v=<hash> cache-buster, so match on the path, not the suffix.
  const siteScript = [...doc.querySelectorAll('script[defer]')]
    .some((t) => /(^|\/)site\.js(\?|$)/.test(t.getAttribute('src') || ''));
  if (!siteScript) note(file, 'shell', 'missing deferred site.js');
  const navLinks = doc.querySelectorAll('.nav__link');
  if (navLinks.length !== 5) note(file, 'shell', `${navLinks.length} nav links (expected 5)`);
  const current = doc.querySelectorAll('.nav__link[aria-current="page"]');
  if (current.length > 1) note(file, 'shell', `${current.length} nav links marked aria-current`);

  /* ---- form labels ---- */
  for (const input of doc.querySelectorAll('input')) {
    const id = input.getAttribute('id');
    const type = (input.getAttribute('type') || 'text').toLowerCase();
    if (type === 'hidden') continue;
    const labelled =
      (id && doc.querySelector(`label[for="${id}"]`)) ||
      input.getAttribute('aria-label') ||
      input.getAttribute('aria-labelledby');
    if (!labelled) note(file, 'a11y', `<input type="${type}" id="${id || ''}"> has no associated label`);
  }

  /* ---- JSON-LD ---- */
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(s.text);
      const flat = JSON.stringify(data);
      for (const banned of ['datePublished', 'isbn', 'numberOfPages', 'aggregateRating', 'publisher"']) {
        if (flat.includes(banned) && banned !== 'publisher"') {
          note(file, 'jsonld', `JSON-LD contains "${banned}" — that fact is not known`);
        }
      }
    } catch (e) {
      note(file, 'jsonld', `JSON-LD does not parse: ${e.message}`);
    }
  }

  /* ---- typography ---- */
  const bodyText = doc.querySelector('body') ? doc.querySelector('body').text : '';
  const straight = (bodyText.match(/\w'\w/g) || []).length;
  if (straight) note(file, 'typography', `${straight} straight apostrophe(s) in body text`);
}

/* ---- Japanese glyph coverage ----------------------------------------
   The JP webfont is subset to an explicit glyph list. A character used on a
   page but absent from the subset silently falls back to a system font (or
   renders as tofu where none exists), so verify coverage rather than trust it. */
{
  const fontCss = readFileSync(path.join(ROOT, 'assets/css/fonts.css'), 'utf8');
  const jpFace = fontCss.split('@font-face').find((b) => b.includes('Noto Serif JP')) || '';
  const covered = new Set();
  const range = (jpFace.match(/unicode-range:\s*([^;]+);/) || [])[1] || '';
  for (const part of range.split(',')) {
    const m = part.trim().match(/^U\+([0-9a-f]+)(?:-([0-9a-f]+))?$/i);
    if (!m) continue;
    const from = parseInt(m[1], 16);
    const to = m[2] ? parseInt(m[2], 16) : from;
    for (let c = from; c <= to; c++) covered.add(c);
  }

  for (const file of htmlFiles) {
    const doc = parse(readFileSync(path.join(ROOT, file), 'utf8'), { comment: false });
    const body = doc.querySelector('body');
    if (!body) continue;
    const missing = new Set();
    for (const ch of body.text) {
      const c = ch.codePointAt(0);
      const isJP = (c >= 0x3040 && c <= 0x30ff) || (c >= 0x4e00 && c <= 0x9fff);
      if (isJP && !covered.has(c)) missing.add(ch);
    }
    if (missing.size) {
      note(file, 'font', `Japanese glyph(s) not in the webfont subset: ${[...missing].join(' ')} ` +
        `— add them to JP_GLYPHS in tools/build-fonts.mjs and re-run it`);
    }
  }
}

/* ---- colour: every accent must survive the deepest ground ---- */
{
  // Resolve a token to a hex literal, following one level of var() aliasing.
  const vars = new Map();
  for (const m of cssText.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    vars.set(m[1], m[2].trim());
  }
  const hexOf = (name, depth = 0) => {
    let v = vars.get(name);
    if (!v || depth > 4) return null;
    const ref = v.match(/^var\((--[\w-]+)\)$/);
    if (ref) return hexOf(ref[1], depth + 1);
    const hex = v.match(/^#([0-9a-f]{6})\b/i);
    return hex ? hex[1] : null;
  };
  const rgb = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = (a) => 0.2126 * lin(a[0]) + 0.7152 * lin(a[1]) + 0.0722 * lin(a[2]);
  const ratio = (a, b) => {
    const x = lum(a), y = lum(b), [hi, lo] = x > y ? [x, y] : [y, x];
    return (hi + 0.05) / (lo + 0.05);
  };
  const over = (fg, alpha, bg) => fg.map((v, i) => Math.round(v * alpha + bg[i] * (1 - alpha)));

  // --paper-deep is the deepest ground --wash-warm can produce. Accent inks
  // are tuned against it, not against flat cream, so a wash can never push one
  // of them under AA.
  const deepHex = hexOf('--paper-deep');
  if (!deepHex) {
    note('site.css', 'colour', '--paper-deep is missing; accent inks cannot be verified');
  } else {
    const deep = rgb(deepHex);
    const inks = ['--ember', '--rose-deep', '--amber-deep', '--olive-deep', '--cobalt', '--ink-soft', '--ink-mute'];
    for (const token of inks) {
      const h = hexOf(token);
      if (!h) { note('site.css', 'colour', `${token} is not a hex colour`); continue; }
      const r = ratio(rgb(h), deep);
      if (r < 4.5) {
        note('site.css', 'colour',
          `${token} #${h} is ${r.toFixed(2)}:1 on --paper-deep #${deepHex} — needs 4.5:1. ` +
          `Darken it, or do not use it as text where a wash can sit underneath.`);
      }
    }
    // Every [data-book] must set an --accent-ink, and it must be one of the above.
    for (const m of cssText.matchAll(/\[data-book="([^"]+)"\]\s*\{([^}]*)\}/g)) {
      if (!/--accent-ink\s*:/.test(m[2])) {
        note('site.css', 'colour', `[data-book="${m[1]}"] does not set --accent-ink`);
      }
      if (!/--accent-rgb\s*:/.test(m[2])) {
        note('site.css', 'colour', `[data-book="${m[1]}"] does not set --accent-rgb (washes need it)`);
      }
    }
  }

  // Text inside dark sections, measured against the navy ground.
  const inkBlueHex = hexOf('--ink-blue');
  if (inkBlueHex) {
    const navy = rgb(inkBlueHex);
    for (const m of cssText.matchAll(/(--on-ink[\w-]*)\s*:\s*rgba\(([^)]+)\)/g)) {
      if (m[1].endsWith('-line')) continue;           // borders, not text
      const parts = m[2].split(',').map((x) => parseFloat(x.trim()));
      const r = ratio(over(parts.slice(0, 3), parts[3], navy), navy);
      if (r < 4.5) {
        note('site.css', 'colour',
          `${m[1]} is ${r.toFixed(2)}:1 on --ink-blue #${inkBlueHex} — needs 4.5:1`);
      }
    }
  }
}

/* ---- books.json is the source of truth: make sure the site agrees ---- */
{
  const data = JSON.parse(readFileSync(path.join(ROOT, 'tools/books.json'), 'utf8'));
  const books = data.books;

  for (const b of books) {
    const page = `${b.slug}.html`;
    if (!existsSync(path.join(ROOT, page))) {
      note('books.json', 'book', `${b.slug}: no page at ${page}`);
      continue;
    }
    // Derivatives the templates reference, plus the press-kit master.
    const needed = ['full.jpg'];
    for (const w of [300, 450, 600, 900]) needed.push(`${w}.jpg`, `${w}.webp`);
    for (const suffix of needed) {
      const f = `assets/img/covers/${b.slug}-${suffix}`;
      if (!existsSync(path.join(ROOT, f))) {
        note('books.json', 'book', `${b.slug}: missing ${f} — run npm run images`);
      }
    }
    if (!existsSync(path.join(ROOT, `assets/img/og/og-${b.slug}.jpg`))) {
      note('books.json', 'book', `${b.slug}: missing social card — run npm run og`);
    }
    // A published book must actually show its buy link.
    if (b.status === 'published') {
      const src = readFileSync(path.join(ROOT, page), 'utf8');
      if (!src.includes(b.asin)) {
        note(page, 'book', `${b.slug} is published but its ASIN ${b.asin} is not on the page`);
      }
    }
  }

  // The books.html structured-data list must match books.json, in order.
  const booksHtml = readFileSync(path.join(ROOT, 'books.html'), 'utf8');
  const ld = booksHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!ld) {
    note('books.html', 'jsonld', 'no JSON-LD block found');
  } else {
    try {
      const graph = JSON.parse(ld[1])['@graph'] || [];
      const list = graph.find((n) => n['@type'] === 'ItemList');
      if (!list) {
        note('books.html', 'jsonld', 'no ItemList in the JSON-LD graph');
      } else {
        const got = (list.itemListElement || []).map((i) => i.item && i.item.name);
        const want = books.map((b) => b.title);
        if (got.join('|') !== want.join('|')) {
          note('books.html', 'jsonld',
            `booklist does not match books.json\n       have: ${got.join(', ')}\n       want: ${want.join(', ')}`);
        }
        if (list.numberOfItems !== books.length) {
          note('books.html', 'jsonld', `numberOfItems is ${list.numberOfItems}, expected ${books.length}`);
        }
      }
    } catch (e) {
      note('books.html', 'jsonld', `JSON-LD does not parse: ${e.message}`);
    }
  }

  // Every real page should be discoverable; 404 deliberately is not.
  const sitemap = readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  for (const file of htmlFiles) {
    if (file === '404.html') continue;
    const loc = file === 'index.html' ? `${BASE}/` : `${BASE}/${file}`;
    if (!sitemap.includes(`<loc>${loc}</loc>`)) {
      note('sitemap.xml', 'sitemap', `missing ${loc}`);
    }
  }
}

/* ---- report ---- */
const byFile = new Map();
for (const p of problems) {
  if (!byFile.has(p.file)) byFile.set(p.file, []);
  byFile.get(p.file).push(p);
}

console.log(`Checked ${htmlFiles.length} pages: ${htmlFiles.join(', ')}\n`);
if (!problems.length) {
  console.log('No problems found.');
} else {
  for (const [file, list] of [...byFile].sort()) {
    console.log(`── ${file}  (${list.length})`);
    for (const p of list) console.log(`   [${p.kind}] ${p.msg}`);
    console.log('');
  }
  console.log(`Total: ${problems.length} problem(s) across ${byFile.size} file(s).`);
}
