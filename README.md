# Ahmed El-Bourgy — author website

The official site for Ahmed El-Bourgy, author of *From Tomorrow*, *Sakura Slice
Café*, *The Perfect Sunrise* and *When You Were There* — all on Kindle — and
*The Blue Bookmark Bookshop*, coming soon.

**Live:** https://ahmedwalid4499.github.io/my-Author-website/

A hand-written static site — no framework, no build step, no dependencies at
runtime. Every page is plain HTML that GitHub Pages can serve as-is. The scripts
in `tools/` exist only to regenerate images and fonts and to QA the markup; they
never run in the browser.

---

## Running it locally

You can open `index.html` straight from disk, but fonts and the manifest behave
better over HTTP:

```bash
cd tools && npm install && npm run serve
```

Then visit http://127.0.0.1:8765. The dev server sends `no-store`, so edits show
up on reload, and it serves `404.html` for unknown paths exactly like GitHub
Pages does.

---

## Layout

```
index.html                  Home
books.html                  Every book
from-tomorrow.html          Book page
sakura-slice-cafe.html      Book page
the-perfect-sunrise.html    Book page
when-you-were-there.html    Book page
the-blue-bookmark-bookshop.html  Book page (announcement, not yet released)
arc.html                    Advance copies: what is running, how to verify it
about.html                  Full biography
press.html                  Press kit — bios, cover art, headshot, book details
contact.html                Contact and reading list
404.html                    Not-found page

favicon.ico  favicon.svg    Site icons
site.webmanifest            Icon + name metadata
robots.txt  sitemap.xml     Search engine directives

assets/
  css/site.css              The whole design system, sectioned and commented
  css/fonts.css             @font-face rules — generated, do not hand-edit
  fonts/*.woff2             Self-hosted webfonts
  js/site.js                Nav, scroll reveal, petals, signup form, copy buttons
  img/covers/               Book covers — 4 widths × webp/jpg, plus a full-size master
  img/author/               Portrait — 3 widths × webp/jpg, plus a full-size master
  img/og/                   1200×630 social share cards, one per page
  img/icon/                 Favicons, touch icon, PWA icons, brand mark

tools/                      Build + QA scripts (never served)
```

Pages are flat `.html` files at the root and every asset path is **relative with
no leading slash**. That is deliberate: the site is served from a GitHub Pages
sub-path (`/my-Author-website/`), where a leading `/` would resolve to the wrong
place. The one exception is `404.html`, which GitHub serves for URLs at any
depth, so it uses absolute `/my-Author-website/...` paths throughout.

---

## Common edits

### Turn on the mailing list

This is the highest-value thing left to do. The signup form is already built,
styled and wired — it just has nowhere to post yet, so right now it falls back to
opening a pre-addressed email.

Pick a provider (Buttondown, Kit/ConvertKit, Mailchimp, or Formspree if you only
want the addresses), copy the form endpoint it gives you, and put it on **one
line** in `assets/js/site.js`:

```js
var NEWSLETTER_ENDPOINT = 'https://buttondown.email/api/emails/embed-subscribe/yourname';
```

The form then POSTs there and shows inline success and error states. Nothing else
needs to change. The form already carries a honeypot field for spam, and the
`<noscript>` fallback still gives readers a working mailto.

### Add a book

`tools/books.json` is the source of truth. The book grids, the footer book
lists, the press-kit cover downloads and the press-kit fact tables are all
generated from it, so you never edit those by hand.

1. Drop the cover in as `assets/img/covers/<slug>-full.jpg` (900 × 1436).
2. Add an entry to `tools/books.json`. Copy an existing one — `status` is
   `published` or `coming-soon`, and `og.hook` is the two italic lines on the
   social card.
3. `cd tools && npm run build` — covers, social card and all generated markup.
4. Copy a book page to `<slug>.html` and replace the prose, the metadata block
   and the JSON-LD. Everything below "More stories" regenerates itself.
5. Add the page to `sitemap.xml`, and the book to the `ItemList` in
   `books.html`'s JSON-LD.
6. If the title uses new Japanese characters, add them to `JP_GLYPHS` in
   `tools/build-fonts.mjs` and run `npm run fonts`.
7. `npm run check` — it fails if any of steps 3–6 were missed.

Changing a book later (a new ASIN, a book going from coming-soon to published)
is usually just `books.json` plus `npm run render`.

### Use a custom domain

1. Add a `CNAME` file at the root containing the bare domain.
2. Point the DNS at GitHub Pages and enable the domain in the repo's
   Settings → Pages.
3. Find and replace `https://ahmedwalid4499.github.io/my-Author-website` with
   the new origin across all `.html` files, `sitemap.xml` and `robots.txt`.
4. In `404.html` only, replace the `/my-Author-website/` path prefix with `/`.

Relative asset paths mean nothing else has to change.

### Change the Japanese text

The Japanese webfont is subset down to exactly the characters used on the site
(about 10 KB instead of several megabytes). If you add a character that is not
already there it will fall back to a system font. Add it to `JP_GLYPHS` in
`tools/build-fonts.mjs` and run `npm run fonts`. `npm run check` fails if you
forget — that is how the 霧 on the 404 page was caught.

---

## The design, and why

Every cover does the same thing: saturated colour along the top, dissolving into
bare watercolour paper at the bottom, with the type down on the dry part. The
site is built from those two materials.

- **Grounds** are paper. `--wash-warm` puts a soft bloom at the top of
  alternating sections and lets it dissolve before any text starts.
- **`--paper-deep` #f0e0cb is the contrast floor.** It is the deepest ground a
  wash can produce, and every accent-text colour is tuned against *it*, not
  against flat cream. Do not deepen it — `npm run check` fails if an accent
  stops clearing 4.5:1 there. (That check caught a real bug: the old
  `--gold-deep` #8f6029 measured 4.19:1 under a wash.)
- **One accent per book**, sampled from its own cover, set by
  `<body data-book="slug">`. `--accent` is decoration only; `--accent-ink` is
  the text-safe variant. Seven uses, listed in §18 of `site.css`. An eighth is
  how a site with five accents loses its centre.
- **Dark sections are navy** `--ink-blue` #16304f rather than the old brown.
  If you prefer the brown, change that one token back — every value on it is
  verified against both.
- **Type**: Cormorant ships a 300–500 weight axis and the site only ever used
  300, which at 5.4rem is a hairline. Displays are 500 now, body Lato is 400.
  Net cost: 68 bytes. The italic file caps at 400, so italic runs set it
  explicitly or the browser synthesises a fake bold.
- **Grain** is a 347-byte SVG tile on `<body>` at 7% opacity. It is texture
  *and* dither — without it the 10%-alpha washes band on 8-bit panels. Ceiling
  is 10%. Never put it on a fixed overlay above the art.
- **Covers are objects**: a spine gradient, a 3px fore-edge sliver sitting
  *outside* the box, and a shadow mixed from the book's own accent. This is why
  `.cover` must never get `overflow: hidden`.
- **Covers are not all the same shape.** The Blue Bookmark is 2:3, the other
  four are 900×1436. `.cover` carries no `aspect-ratio`; each image's own
  `width`/`height` attributes reserve its space, so nothing is ever cropped and
  there is still no layout shift. `coverW`/`coverH` in `books.json` feed those
  attributes.
- **The Blue Bookmark title is the lettering from its cover**, lifted off the
  sky by `tools/extract-wordmark.mjs` and saved to `assets/img/wordmark/`. It
  is cream and pink, so it only reads on a dark ground — that is why both its
  hero and the home hero are cobalt. Never place it on paper.

---

## Advance reader copies

`tools/arc/` builds one ready-to-send email per advance reader, themed to the
book, with the EPUB attached.

```bash
cd tools && npm run arc        # the panel, at http://127.0.0.1:8787
```

A local admin page: campaign fields, the reader list, a live preview, and
buttons to build the `.eml` files or send. **It cannot live on the website** —
GitHub Pages has no server behind it, so it could not send mail or hold a
password, and a public send-mail page would let anyone send as you. The panel
binds to `127.0.0.1` and dies with the terminal.

Sending goes through your own Gmail with an app password you type into the
page, which is what makes it provably you: a message that genuinely leaves your
account carries Google's DKIM signature. A well-designed email proves nothing
on its own.

`node arc/build.mjs` does the same thing without the UI.

The other half is `arc.html`, which states the campaign actually running. The
email points readers at it so they can check independently. **Keep that page
current** — it is worth nothing if it goes stale, and the note in the HTML says
so.

`tools/arc/readers.csv`, `tools/arc/out/` and any `.epub` are git-ignored.
Reader addresses and an unreleased manuscript must not reach a public repo.
Full detail in `tools/arc/README.md`.

---

## Checking your work

```bash
cd tools && npm run check
```

`check.mjs` parses every page and reports: broken internal links and missing
assets, duplicate `id`s, missing or skipped headings, images without
`alt`/`width`/`height`, `target="_blank"` without `rel="noopener"`, inline
styles, class names that do not exist in `site.css`, missing or wrong
canonical/Open Graph metadata, unlabelled form inputs, invalid JSON-LD,
leading-slash paths that would break on the Pages sub-path, and Japanese
characters used on a page but missing from the subset webfont.

It also cross-checks the site against `tools/books.json`: every book has a page,
a full set of cover derivatives and a social card; a published book shows its
ASIN; the `books.html` structured-data list matches, in order; every page is in
`sitemap.xml`; and the generated markup is current (`npm run render` would be a
no-op).

Run it after any edit. It should print `No problems found.`

---

## Notes on how it is built

**Performance.** The previous version of this site was a single 2 MB HTML file
with every image base64-inlined — and each book cover embedded twice. Images are
now real files served at four widths in WebP with JPEG fallbacks, so a phone
downloads roughly 30 KB per cover instead of 300 KB. Fonts are self-hosted
(no third-party connection), Cormorant Garamond is a variable font so one file
covers every weight, and the Japanese face is glyph-subset. Every image declares
its dimensions, so nothing shifts as the page loads.

**Accessibility.** Skip link, visible focus rings that stay legible on both the
cream and ink backgrounds, 44px minimum touch targets, a keyboard-operable mobile
menu that closes on Escape and returns focus, labelled form fields, and
`aria-current` on the active nav item. Body and small text meet WCAG AA contrast
on their backgrounds — note that `--gold` is decorative only; `--gold-deep` is
the variant that passes as text on cream. Everything animated is disabled under
`prefers-reduced-motion`, including the falling petals.

**Resilience.** Scroll-reveal is gated behind a `.js` class, so with scripting
blocked the content is simply visible rather than stuck invisible, and a
`beforeprint` handler plus print styles make sure unscrolled sections still
print.

**Honesty.** There are no invented review quotes, ratings, publication dates,
page counts, ISBNs or press mentions anywhere on this site. The press kit has
HTML comments marking where those belong once they exist. The old Goodreads
reviews widget was removed rather than repaired: it was embedded with an
unfilled `DEVELOPER_ID`, sandboxed so it could not run, and the widget has since
been deprecated. Book pages link out to Goodreads and Amazon instead.
