import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'fs';

import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const OUT = path.join(ROOT, 'assets/img/icon');
mkdirSync(OUT, { recursive: true });

// One sakura petal, tip pointing up, springing from just outside the flower
// centre. Kept narrow enough that five of them at 72° stay visually separate,
// with a deep V notch at the tip so the silhouette reads as cherry blossom.
const PETAL =
  'M0 -5 C-7 -9,-12.5 -18,-10.6 -28 C-9 -35.5,-4.6 -38.5,-2.2 -34.2 ' +
  'L0 -28.5 L2.2 -34.2 C4.6 -38.5,9 -35.5,10.6 -28 C12.5 -18,7 -9,0 -5 Z';

function blossom({ petal, center, stroke }) {
  const petals = [0, 72, 144, 216, 288]
    .map((a) => `<path d="${PETAL}" transform="rotate(${a})" fill="${petal}"${stroke ? ` stroke="${stroke}" stroke-width="1.6"` : ''}/>`)
    .join('');
  return `<g transform="translate(50 52)">${petals}<circle r="4.6" fill="${center}"/></g>`;
}

const GOLD = '#c8915a';
const GOLD_L = '#e8c9a0';
const INK = '#2c1f14';
const CREAM = '#fdf8f0';

// Favicon / touch icon: warm gold blossom on deep ink, works at 16px.
const markSvg = (bgFill, petal, center) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">` +
  (bgFill ? `<rect width="100" height="100" rx="20" fill="${bgFill}"/>` : '') +
  blossom({ petal, center }) +
  `</svg>`;

// 1. favicon.svg — scalable, adapts to dark mode via media query
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <style>
    .bg { fill: ${INK}; }
    .petal { fill: ${GOLD}; }
    .core { fill: ${CREAM}; }
    @media (prefers-color-scheme: dark) {
      .bg { fill: ${CREAM}; }
      .petal { fill: ${GOLD}; }
      .core { fill: ${INK}; }
    }
  </style>
  <rect class="bg" width="100" height="100" rx="20"/>
  <g transform="translate(50 52)">
    ${[0, 72, 144, 216, 288].map((a) => `<path class="petal" d="${PETAL}" transform="rotate(${a})"/>`).join('\n    ')}
    <circle class="core" r="4.6"/>
  </g>
</svg>
`;
writeFileSync(path.join(ROOT, 'favicon.svg'), faviconSvg);

const inkMark = markSvg(INK, GOLD, CREAM);

async function png(svg, size, file, density = 4) {
  await sharp(Buffer.from(svg), { density: 72 * density })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, file));
}

await png(inkMark, 16, 'favicon-16.png');
await png(inkMark, 32, 'favicon-32.png');
await png(inkMark, 48, 'favicon-48.png');
await png(inkMark, 180, 'apple-touch-icon.png');
await png(inkMark, 192, 'icon-192.png');
await png(inkMark, 512, 'icon-512.png');

// Maskable icon: blossom inset to the safe zone (80% of the canvas)
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect width="100" height="100" fill="${INK}"/>
  <g transform="translate(50 51) scale(0.72) translate(-50 -52)">${blossom({ petal: GOLD, center: CREAM })}</g>
</svg>`;
await png(maskable, 512, 'icon-maskable-512.png');

// Multi-resolution .ico for legacy /favicon.ico requests
const ico16 = await sharp(Buffer.from(inkMark), { density: 288 }).resize(16, 16).png().toBuffer();
const ico32 = await sharp(Buffer.from(inkMark), { density: 288 }).resize(32, 32).png().toBuffer();
const ico48 = await sharp(Buffer.from(inkMark), { density: 288 }).resize(48, 48).png().toBuffer();

function buildIco(pngs) {
  const n = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(n, 4);
  const entries = []; const datas = [];
  let offset = 6 + n * 16;
  for (const { size, buf } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size === 256 ? 0 : size, 0);
    e.writeUInt8(size === 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buf.length, 8); e.writeUInt32LE(offset, 12);
    entries.push(e); datas.push(buf); offset += buf.length;
  }
  return Buffer.concat([header, ...entries, ...datas]);
}
writeFileSync(path.join(ROOT, 'favicon.ico'), buildIco([
  { size: 16, buf: ico16 }, { size: 32, buf: ico32 }, { size: 48, buf: ico48 },
]));


console.log('icons done');
