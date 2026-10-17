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
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = JSON.parse(readFileSync(path.join(ROOT, 'tools/books.json'), 'utf8'));
const BOOKS = DATA.books;


/** Straight quotes to typographic ones. Presentation only — source files are
 *  left exactly as written. */
function typo(str) {
  return String(str)
    .replace(/"([^"]*)"/g, '\u201c$1\u201d')
    .replace(/'/g, '\u2019');
}

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


/* ---- Aoi Shiori page: quiz data and tracklist ------------------------- */

const QUIZ = JSON.parse(readFileSync(path.join(ROOT, 'tools/quiz.json'), 'utf8'));
const PLAYLIST = JSON.parse(readFileSync(path.join(ROOT, 'tools/playlist.json'), 'utf8'));

/**
 * The quiz runs in the browser, so its data is inlined at build time rather
 * than fetched: one request fewer, and it cannot half-load. Image paths are
 * rewritten from the content pack's layout to the repo's, so quiz.json stays
 * exactly as the author wrote it.
 */
function quizData() {
  const data = JSON.parse(JSON.stringify(QUIZ));
  data.title = typo(data.title);
  data.subtitle = typo(data.subtitle);
  data.shareText = typo(data.shareText);
  for (const q of data.questions) {
    q.q = typo(q.q);
    q.answers = q.answers.map(([text, key]) => [typo(text), key]);
  }
  for (const r of Object.values(data.results)) {
    for (const k of ['name', 'nickname', 'description', 'bookmark', 'chapter']) {
      r[k] = typo(r[k]);
    }
    const base = r.image.replace(/^assets\//, '').replace(/\.png$/, '');
    r.image = `assets/img/pastry/${base}`;      // -320.webp / -640.webp
  }
  return '\n      <script type="application/json" id="quiz-data">'
    + JSON.stringify(data) + '</script>';
}

/** The tracklist is server-rendered so the page is worth reading with JS off. */
function tracklist() {
  const rows = PLAYLIST.tracks
    .filter((t) => t.title)
    .map((t, i) => `        <li class="track">
          <span class="track__no">${String(i + 1).padStart(2, '0')}</span>
          <span class="track__body">
            <span class="track__title">${esc(typo(t.title))}</span>
            <span class="track__artist">${esc(typo(t.artist))}</span>
            ${t.moment ? `<span class="track__moment">${esc(typo(t.moment))}</span>` : ''}
          </span>
        </li>`);
  return '\n' + rows.join('\n') + '\n      ';
}

function bonusTracks() {
  const rows = (PLAYLIST.bonus || PLAYLIST.bonusTracks || [])
    .filter((t) => t.title)
    .map((t) => `        <li>
          <span class="track__title">${esc(typo(t.title))}</span>
          <span class="track__artist">${esc(typo(t.artist))}</span>
          ${t.moment ? `<span class="track__moment">${esc(typo(t.moment))}</span>` : ''}
        </li>`);
  return '\n' + rows.join('\n') + '\n      ';
}


/** Eight hex characters of the file's content, for cache-busting its URL. */
function assetHash(rel) {
  const abs = path.join(ROOT, rel);
  if (!existsSync(abs)) return null;
  return createHash('sha1').update(readFileSync(abs)).digest('hex').slice(0, 8);
}

/**
 * Stamp ?v=<hash> on the stylesheets and scripts every page links to. Without
 * it, a CSS fix can sit live for ten minutes while the browser still paints the
 * old rules, and the only clue is that nothing appears to have changed.
 */
function stampAssets(html) {
  const assets = ['assets/css/fonts.css', 'assets/css/site.css',
                  'assets/js/site.js', 'assets/js/quiz.js',
                  'assets/js/recipes.js'];
  for (const rel of assets) {
    const h = assetHash(rel);
    if (!h) continue;
    const file = rel.split('/').pop();
    // Matches both the plain path and one already carrying a ?v=
    const re = new RegExp(`((?:\\.\\./)*(?:/my-Author-website/)?assets/(?:css|js)/${file.replace('.', '\\.')})(\\?v=[0-9a-f]+)?`, 'g');
    html = html.replace(re, `$1?v=${h}`);
  }
  return html;
}


/* ---- the book page: pastry cards and recipe data ---------------------- */

const RECIPES = JSON.parse(readFileSync(path.join(ROOT, 'tools/recipes.json'), 'utf8'));

/**
 * The grid art and the recipes come from different sets: the cards use the
 * cream-ground squares, the dialog uses the cut-out art. This maps one to the
 * other, in the order the pastries appear in the book. `recipe: null` means
 * there is no recipe for it yet, so that card is not a button.
 */
const PASTRY_CARDS = [
  { slug: 'hot-chocolate',    recipe: 'hotchocolate', w: 2000, h: 2000,
    alt: 'A navy mug of hot chocolate with marshmallows, a blue bookmark ribbon against the cup.' },
  { slug: 'cheesecake',       recipe: 'cheesecake',   w: 1024, h: 1024,
    alt: 'A slice of cheesecake with strawberry sauce and a strawberry on top.' },
  { slug: 'blueberry-tart',   recipe: 'tart',         w: 1024, h: 1024,
    alt: 'A blueberry tart with one slice cut away, a fork on the plate.' },
  { slug: 'mille-feuille',    recipe: 'millefeuille', w: 1024, h: 1024,
    alt: 'A mille-feuille with feathered icing and a single cherry blossom petal beside it.' },
  { slug: 'cream-puff',       recipe: 'creampuff',    w: 1024, h: 1024,
    alt: 'A cream puff dusted with icing sugar on a blue-rimmed plate.' },
  { slug: 'chocolate-pastry', recipe: 'eclair',       w: 1024, h: 1024,
    alt: 'A chocolate-dipped cream bun in a spotted paper bag, one bite taken.' },
  { slug: 'birthday-cake',    recipe: null,           w: 1024, h: 1024,
    name: 'Birthday Cake',
    alt: 'A small pink birthday cake with sprinkles and one lit candle on a cake stand.' },
];

function pastryArt(c) {
  const b = `assets/img/pastries/${c.slug}`;
  return `<picture>
              <source type="image/webp" srcset="${b}-240.webp 240w, ${b}-480.webp 480w" sizes="(max-width: 620px) 42vw, 190px">
              <img src="${b}-240.jpg" srcset="${b}-240.jpg 240w, ${b}-480.jpg 480w" sizes="(max-width: 620px) 42vw, 190px"
                   width="${c.w}" height="${c.h}" alt="${esc(c.alt)}" loading="lazy" decoding="async">
            </picture>`;
}

function pastryGrid() {
  const rows = PASTRY_CARDS.map((c) => {
    const r = c.recipe ? RECIPES.recipes[c.recipe] : null;
    const name = typo(r ? r.name : c.name);
    const jp = r ? `\n            <span class="pastry__jp jp">${r.japanese}</span>` : '';

    if (!r) {
      return `        <li class="pastry pastry--plain">
          <span class="pastry__art">${pastryArt(c)}</span>
          <span class="pastry__name">${esc(name)}</span>
        </li>`;
    }
    return `        <li class="pastry">
          <button class="pastry__open" type="button" data-recipe="${c.recipe}" aria-haspopup="dialog">
            <span class="pastry__art">${pastryArt(c)}</span>
            <span class="pastry__name">${esc(name)}</span>${jp}
            <span class="pastry__cue">Recipe</span>
          </button>
        </li>`;
  });
  return '\n' + rows.join('\n') + '\n      ';
}

/** Inlined like the quiz data: one request fewer, and it cannot half-load. */
function recipeData() {
  const data = JSON.parse(JSON.stringify(RECIPES));
  data.title = typo(data.title);
  data.subtitle = typo(data.subtitle);
  data.tabs.mirai = typo(data.tabs.mirai);
  data.tabs.recipe = typo(data.tabs.recipe);
  for (const r of Object.values(data.recipes)) {
    r.name = typo(r.name);
    r.chapter = typo(r.chapter);
    r.mirai.intro = typo(r.mirai.intro);
    r.mirai.hare = typo(r.mirai.hare);
    r.mirai.method = r.mirai.method.map(typo);
    r.recipe.steps = r.recipe.steps.map(typo);
    r.recipe.tip = typo(r.recipe.tip);
    r.recipe.ingredients = r.recipe.ingredients.map((g) => ({
      group: typo(g.group),
      items: g.items.map(typo),
    }));
    // Point the dialog art at the cut-out set rather than the content pack.
    r.image = 'assets/img/pastry/' + r.image.replace(/^assets\//, '').replace(/\.png$/, '');
  }
  return '\n      <script type="application/json" id="recipe-data">'
    + JSON.stringify(data) + '</script>';
}

const REGIONS = {
  'books-grid': booksGrid,
  'footer-books': footerBooks,
  'cover-downloads': coverDownloads,
  'book-facts': bookFacts,
  'quiz-data': quizData,
  'recipe-data': recipeData,
  'pastry-grid': pastryGrid,
  'tracklist': tracklist,
  'bonus-tracks': bonusTracks,
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
    if (name === 'quiz-data' || name === 'recipe-data') {
      // This region replaces a whole <script> element rather than the text
      // inside one, because a script's content is raw text: a marker comment
      // placed inside it would be parsed as part of the JSON.
      const re = new RegExp(`(<!--\\s*gen:${name}([^>]*?)-->)[\\s\\S]*?<\\/script>`, 'g');
      after = after.replace(re, (_m, marker, rawOpts) => {
        hits.push(name);
        return marker + build(opts(rawOpts));
      });
      continue;
    }

    const close = (name === 'footer-books' || name === 'tracklist'
                   || name === 'bonus-tracks' || name === 'pastry-grid')
      ? '</ul>' : '</div>';
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

  after = stampAssets(after);

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
