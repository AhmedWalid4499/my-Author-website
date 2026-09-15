import { parse } from 'node-html-parser';
import { readFileSync, existsSync, readdirSync } from 'fs';

import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const BASE = 'https://ahmedwalid4499.github.io/my-Author-website';
const PAGES_PREFIX = '/my-Author-website/';

const problems = [];
const note = (file, kind, msg) => problems.push({ file, kind, msg });

const htmlFiles = readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();

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
  if (!doc.querySelector('script[src$="site.js"][defer]')) note(file, 'shell', 'missing deferred site.js');
  const navLinks = doc.querySelectorAll('.nav__link');
  if (navLinks.length !== 4) note(file, 'shell', `${navLinks.length} nav links (expected 4)`);
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
