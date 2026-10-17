/**
 * Regenerate the repeated book markup from tools/books.json.
 *
 * The pages are hand-written static HTML, but three regions repeat across all
 * of them and used to drift apart whenever a book was added. Each is fenced by
 * a marker comment carrying its options:
 *
 *   <div class="books-grid">
 *     <!-- gen:books-grid level=3 eyebrow=no blurb=long prefix= exclude=slug -->
 *     ...generated...
 *   </div>
 *
 *   <ul class="footer-list">
 *     <!-- gen:footer-books prefix= -->
 *     ...generated...
 *   </ul>
 *
 * Everything outside the markers is yours to edit by hand.
 *
 * Run:  node tools/render.mjs        (or npm run render)
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = JSON.parse(readFileSync(path.join(ROOT, 'tools/books.json'), 'utf8'));
const BOOKS = DATA.books;

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Parse `key=value` pairs off a marker comment. Bare `key` means "yes". */
function opts(str) {
  const o = {};
  for (const tok of str.trim().split(/\s+/).filter(Boolean)) {
    const i = tok.indexOf('=');
    if (i === -1) o[tok] = 'yes';
    else o[tok.slice(0, i)] = tok.slice(i + 1);
  }
  return o;
}

function card(b, o, isFirst) {
  const p = o.prefix || '';
  const L = o.level || '3';
  const published = b.status === 'published';
  const blurb = o.blurb === 'short' ? b.shortBlurb : b.blurb;
  const img = `assets/img/covers/${b.slug}`;

  // Only the page that leads with the grid preloads its first cover; everywhere
  // else the covers are below the fold.
  const loading =
    isFirst && o.first === 'high'
      ? 'fetchpriority="high" decoding="async"'
      : 'loading="lazy" decoding="async"';

  // books.json can override the badge, e.g. when the grid image is not the final cover.
  const badge = published ? '' : `\n              <span class="badge">${esc(b.badge || 'Coming soon')}</span>`;
  const eyebrow =
    o.eyebrow === 'yes'
      ? `\n          <p class="eyebrow">${published ? 'Available on Kindle' : 'Coming soon'}</p>`
      : '';

  return `        <article class="book-card fade-in">
          <a class="book-card__link" href="${p}${b.slug}.html">
            <span class="cover">${badge}
              <picture>
                <source type="image/webp"
                        srcset="${p}${img}-300.webp 300w,
                                ${p}${img}-450.webp 450w,
                                ${p}${img}-600.webp 600w"
                        sizes="(max-width: 720px) 60vw, 300px">
                <img src="${p}${img}-450.jpg"
                     srcset="${p}${img}-300.jpg 300w,
                             ${p}${img}-450.jpg 450w,
                             ${p}${img}-600.jpg 600w"
                     sizes="(max-width: 720px) 60vw, 300px"
                     width="${b.coverW}" height="${b.coverH}"
                     alt="${esc(b.coverAlt)}"
                     ${loading}>
              </picture>
            </span>
            <h${L} class="book-card__title mt-md">${esc(b.title)}</h${L}>
${b.jp ? `
            <p class="jp book-card__jp">${b.jp}</p>` : ''}
          </a>${eyebrow}${blurb ? `
          <p class="book-card__blurb">${blurb}</p>` : ''}
          <a class="text-link" href="${p}${b.slug}.html">Read more <span class="text-link__arrow" aria-hidden="true">↗</span><span class="visually-hidden"> about ${esc(b.title)}</span></a>
        </article>`;
}

function booksGrid(o) {
  const list = BOOKS.filter((b) => b.slug !== o.exclude);
  return '\n\n' + list.map((b, i) => card(b, o, i === 0)).join('\n\n') + '\n';
}

function footerBooks(o) {
  const p = o.prefix || '';
  const rows = BOOKS.map((b) => `          <li><a href="${p}${b.slug}.html">${esc(b.title)}</a></li>`);
  rows.push(`          <li><a href="${p}books.html">All books</a></li>`);
  return '\n' + rows.join('\n');
}


function coverDownloads() {
  return '\n\n' + BOOKS.map((b) => {
    const img = `assets/img/covers/${b.slug}`;
    return `        <article class="download-card fade-in">
          <span class="download-card__thumb">
            <picture>
              <source type="image/webp"
                      srcset="${img}-300.webp 300w,
                              ${img}-450.webp 450w"
                      sizes="96px">
              <img src="${img}-300.jpg"
                   srcset="${img}-300.jpg 300w,
                           ${img}-450.jpg 450w"
                   sizes="96px"
                   width="${b.coverW}" height="${b.coverH}"
                   alt="${esc(b.coverAlt)}"
                   loading="lazy" decoding="async">
            </picture>
          </span>
          <h3 class="download-card__title">${esc(b.title)} — cover</h3>
          <p class="download-card__meta">JPEG · ${b.coverW} × ${b.coverH}</p>
          <a class="text-link" href="${img}-full.jpg" download="${b.slug}-cover-ahmed-el-bourgy.jpg">Download <span class="text-link__arrow" aria-hidden="true">↓</span><span class="visually-hidden"> the cover of ${esc(b.title)}</span></a>
        </article>`;
  }).join('\n\n') + '\n';
}

function bookFacts() {
  return '\n\n' + BOOKS.map((b, i) => {
    const published = b.status === 'published';
    const gr = b.goodreads
      ? `<a href="${b.goodreads}" target="_blank" rel="noopener">Book page on Goodreads</a>`
      : `<a href="${DATA.goodreadsAuthor}" target="_blank" rel="noopener">Author page on Goodreads</a> — no book page yet`;
    // An ASIN only exists once the book is on sale.
    const asin = published
      ? `\n          <dt>ASIN</dt>\n          <dd><a href="https://www.amazon.com/dp/${b.asin}" target="_blank" rel="noopener">${b.asin}</a></dd>`
      : '';
    return `      <article class="fade-in${i ? ' mt-lg' : ''}">
        <h3 class="display-4">${esc(b.title)}</h3>
        <!-- Publication date, page count and ISBN can be added to this list when they are known. -->
        <dl class="facts mt-md">
          <dt>Title</dt>
          <dd>${esc(b.title)}</dd>
${b.jp ? `
          <dt>Japanese title</dt>
          <dd><span class="jp">${b.jp}</span></dd>` : ''}
          <dt>Author</dt>
          <dd>Ahmed El-Bourgy</dd>
          <dt>Format</dt>
          <dd>${published ? 'Kindle eBook' : 'To be announced'}</dd>${asin}
          <dt>Status</dt>
          <dd>${published ? 'Published' : 'Coming soon — not yet published'}</dd>
          <dt>Goodreads</dt>
          <dd>${gr}</dd>
        </dl>
      </article>`;
  }).join('\n\n') + '\n';
}

const REGIONS = {
  'books-grid': booksGrid,
  'footer-books': footerBooks,
  'cover-downloads': coverDownloads,
  'book-facts': bookFacts,
};

// --check verifies the pages are already up to date without writing.
const CHECK = process.argv.includes('--check');
let changed = 0;
const stale = [];
for (const file of readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort()) {
  const abs = path.join(ROOT, file);
  const before = readFileSync(abs, 'utf8');
  let after = before;
  const hits = [];

  for (const [name, build] of Object.entries(REGIONS)) {
    // Replace from the marker up to the close of its container. Cards contain
    // no <div> and footer rows no <ul>, so the first close tag is the right one.
    const close = name === 'footer-books' ? '</ul>' : '</div>';
    // Consume everything between the marker and the closing tag, including the
    // final newline + indent, so repeated runs cannot accumulate blank lines.
    const re = new RegExp(
      `(<!--\\s*gen:${name}([^>]*?)-->)[\\s\\S]*?(\\n[ \\t]*)(?=${close})`,
      'g'
    );
    after = after.replace(re, (_m, marker, rawOpts, tail) => {
      hits.push(name);
      return marker + build(opts(rawOpts)) + tail;
    });
  }

  if (after !== before) {
    if (CHECK) {
      stale.push(file);
    } else {
      writeFileSync(abs, after);
      console.log(`  ${file.padEnd(26)} ${hits.join(', ')}`);
    }
    changed++;
  } else if (hits.length) {
    console.log(`  ${file.padEnd(26)} ${hits.join(', ')} (unchanged)`);
  }
}
if (CHECK) {
  if (stale.length) {
    console.error(
      `Generated book markup is out of date in: ${stale.join(', ')}\n` +
      `Run "npm run render" after editing tools/books.json.`
    );
    process.exit(1);
  }
  console.log('Generated book markup is up to date.');
} else {
  console.log(changed ? `\n${changed} file(s) rewritten.` : '\nNothing to do.');
}
