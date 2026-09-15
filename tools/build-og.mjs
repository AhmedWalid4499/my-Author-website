import sharp from 'sharp';
import { mkdirSync } from 'fs';

import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const OUT = path.join(ROOT, 'assets/img');
const COVERS = path.join(OUT, 'covers');
mkdirSync(path.join(OUT, 'og'), { recursive: true });

const SERIF = "Georgia, 'Times New Roman', serif";
const SERIF_I = "Baskerville, Georgia, serif";
const SANS = "Helvetica, Arial, sans-serif";
const JP = "'Hiragino Mincho ProN', 'Yu Mincho', serif";

const INK = '#2c1f14';
const INK_SOFT = '#6b5040';
const GOLD = '#c8915a';
const GOLD_L = '#e8c9a0';
const CREAM = '#fdf8f0';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function bg(extra = '') {
  return `
  <defs>
    <radialGradient id="g1" cx="72%" cy="38%" r="62%">
      <stop offset="0%" stop-color="${GOLD}" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="${GOLD}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g2" cx="18%" cy="78%" r="55%">
      <stop offset="0%" stop-color="#d4687a" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#d4687a" stop-opacity="0"/>
    </radialGradient>
    <filter id="sh" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="10" dy="16" stdDeviation="18" flood-color="#2c1f14" flood-opacity="0.28"/>
    </filter>
  </defs>
  <rect width="1200" height="630" fill="${CREAM}"/>
  <rect width="1200" height="630" fill="url(#g1)"/>
  <rect width="1200" height="630" fill="url(#g2)"/>
  ${extra}`;
}

// Soft shadow plate behind a cover placed at x,y,w,h
const plate = (x, y, w, h) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${INK}" filter="url(#sh)" opacity="0.9"/>`;

const eyebrow = (x, y, text, fill = GOLD) =>
  `<text x="${x}" y="${y}" font-family="${SANS}" font-size="19" letter-spacing="5.5" fill="${fill}">${esc(text.toUpperCase())}</text>`;

const rule = (x, y, w, color = GOLD_L) =>
  `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${color}"/>`;

async function render(name, svg, composites = []) {
  const full = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">${svg}</svg>`;
  const img = sharp(Buffer.from(full));
  const out = composites.length ? img.composite(composites) : img;
  await out.jpeg({ quality: 88, mozjpeg: true, progressive: true }).toFile(path.join(OUT, 'og', `${name}.jpg`));
  console.log('  og/' + name + '.jpg');
}

// ---------------------------------------------------------------- book cards
const BOOKS = [
  {
    slug: 'from-tomorrow',
    lines: [['From ', 'Tomorrow']],
    jp: '明日から',
    hook: 'A train line closing in three days.',
    hook2: 'Notes from a day she hasn’t lived yet.',
    tag: 'Out now on Kindle',
  },
  {
    slug: 'sakura-slice-cafe',
    lines: [['Sakura Slice', ' Café']],
    jp: '桜スライス・カフェ',
    hook: 'Thirteen quiet stories from a café',
    hook2: 'that was never just a café.',
    tag: 'Out now on Kindle',
  },
  {
    slug: 'the-perfect-sunrise',
    lines: [['The Perfect', ' Sunrise']],
    jp: '完璧な日の出',
    hook: 'A photograph falls from the sky —',
    hook2: 'already perfect, and dated tomorrow.',
    tag: 'Coming soon',
  },
];

const CW = 296, CH = 472, CX = 96, CY = 79;

for (const b of BOOKS) {
  const [a, em] = b.lines[0];
  const x = 470;
  const svg = bg(plate(CX, CY, CW, CH)) + `
    ${eyebrow(x, 150, 'Ahmed El-Bourgy')}
    <text x="${x}" y="228" font-family="${SERIF}" font-size="66" fill="${INK}">${esc(a)}<tspan font-family="${SERIF_I}" font-style="italic" fill="${GOLD}">${esc(em)}</tspan></text>
    <text x="${x}" y="272" font-family="${JP}" font-size="23" letter-spacing="3" fill="${INK_SOFT}">${esc(b.jp)}</text>
    ${rule(x, 312, 72)}
    <text x="${x}" y="372" font-family="${SERIF_I}" font-style="italic" font-size="30" fill="${INK_SOFT}">${esc(b.hook)}</text>
    <text x="${x}" y="414" font-family="${SERIF_I}" font-style="italic" font-size="30" fill="${INK_SOFT}">${esc(b.hook2)}</text>
    ${eyebrow(x, 492, b.tag)}
  `;
  const cover = await sharp(path.join(COVERS, `${b.slug}-600.jpg`))
    .resize({ width: CW, height: CH, fit: 'cover' }).png().toBuffer();
  await render(`og-${b.slug}`, svg, [{ input: cover, left: CX, top: CY }]);
}

// ---------------------------------------------------------------- home / books
async function threeCovers(y, h, gap, centerX) {
  const w = Math.round(h * (900 / 1436));
  const total = w * 3 + gap * 2;
  let x = Math.round(centerX - total / 2);
  const plates = [];
  const comps = [];
  for (const b of BOOKS) {
    plates.push(plate(x, y, w, h));
    comps.push({
      input: await sharp(path.join(COVERS, `${b.slug}-450.jpg`))
        .resize({ width: w, height: h, fit: 'cover' }).png().toBuffer(),
      left: x, top: y,
    });
    x += w + gap;
  }
  return { plates: plates.join(''), comps };
}

{
  const { plates, comps } = await threeCovers(300, 250, 30, 600);
  const svg = bg(plates) + `
    <text x="600" y="150" text-anchor="middle" font-family="${SERIF}" font-size="76" fill="${INK}">Ahmed <tspan font-family="${SERIF_I}" font-style="italic" fill="${GOLD}">El-Bourgy</tspan></text>
    <text x="600" y="196" text-anchor="middle" font-family="${JP}" font-size="22" letter-spacing="6" fill="${INK_SOFT}">物語を紡ぐ人</text>
    <text x="600" y="252" text-anchor="middle" font-family="${SERIF_I}" font-style="italic" font-size="29" fill="${INK_SOFT}">Stories about the quiet magic hiding in ordinary moments.</text>
  `;
  await render('og-home', svg, comps);
}

{
  const { plates, comps } = await threeCovers(290, 258, 34, 600);
  const svg = bg(plates) + `
    ${eyebrow(600, 118, 'Published & Coming Soon')}
    <text x="600" y="196" text-anchor="middle" font-family="${SERIF}" font-size="70" fill="${INK}">The <tspan font-family="${SERIF_I}" font-style="italic" fill="${GOLD}">Books</tspan></text>
    <text x="600" y="242" text-anchor="middle" font-family="${SERIF_I}" font-style="italic" font-size="27" fill="${INK_SOFT}">Three worlds, each with its own heartbeat.</text>
  `;
  await render('og-books', svg.replace('<text x="600" y="118"', '<text text-anchor="middle" x="600" y="118"'), comps);
}

// ---------------------------------------------------------------- about
{
  const PW = 300, PH = 400, PX = 118, PY = 115;
  const svg = bg(plate(PX, PY, PW, PH)) + `
    ${eyebrow(510, 178, 'The Author')}
    <text x="510" y="262" font-family="${SERIF}" font-size="70" fill="${INK}">About <tspan font-family="${SERIF_I}" font-style="italic" fill="${GOLD}">Me</tspan></text>
    ${rule(510, 306, 72)}
    <text x="510" y="366" font-family="${SERIF_I}" font-style="italic" font-size="29" fill="${INK_SOFT}">An Egyptian boy who had always dreamt</text>
    <text x="510" y="406" font-family="${SERIF_I}" font-style="italic" font-size="29" fill="${INK_SOFT}">of magic — and writes it down.</text>
    ${eyebrow(510, 478, 'Cairo, Egypt')}
  `;
  const photo = await sharp(path.join(OUT, 'author', 'ahmed-el-bourgy-480.jpg'))
    .resize({ width: PW, height: PH, fit: 'cover' }).png().toBuffer();
  await render('og-about', svg, [{ input: photo, left: PX, top: PY }]);
}

// ---------------------------------------------------------------- press / contact
const simple = (name, label, title, em, l1, l2) => {
  const svg = bg() + `
    <text x="600" y="232" text-anchor="middle" font-family="${SANS}" font-size="19" letter-spacing="5.5" fill="${GOLD}">${esc(label.toUpperCase())}</text>
    <text x="600" y="326" text-anchor="middle" font-family="${SERIF}" font-size="76" fill="${INK}">${esc(title)}<tspan font-family="${SERIF_I}" font-style="italic" fill="${GOLD}">${esc(em)}</tspan></text>
    <text x="600" y="392" text-anchor="middle" font-family="${SERIF_I}" font-style="italic" font-size="29" fill="${INK_SOFT}">${esc(l1)}</text>
    <text x="600" y="432" text-anchor="middle" font-family="${SERIF_I}" font-style="italic" font-size="29" fill="${INK_SOFT}">${esc(l2)}</text>
    ${rule(540, 480, 120)}
    <text x="600" y="522" text-anchor="middle" font-family="${SANS}" font-size="17" letter-spacing="4.5" fill="${INK_SOFT}">AHMED EL-BOURGY</text>
  `;
  return render(name, svg);
};

await simple('og-press', 'Press & Media', 'Press ', 'Kit', 'Bios, cover art, headshots and book details', 'for press, bloggers and booksellers.');
await simple('og-contact', 'Reach Out', 'Let’s ', 'Connect', 'Talk about the books, share what a story meant', 'to you, or simply say hello.');
await simple('og-404', 'Page Not Found', 'Lost in the ', 'Fog', 'This page slipped through to a day', 'that hasn’t happened yet.');

console.log('og cards done');
