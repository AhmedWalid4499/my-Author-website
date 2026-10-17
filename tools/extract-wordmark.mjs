/**
 * Lift the hand-lettered title off the cover's sky.
 *
 * The sky is strongly blue (B well above R) and both ink colours sit at or
 * below R, so the channel difference separates ink from sky cleanly. What it
 * cannot separate is a round letter from a round blossom petal, so components
 * are enumerated and the petals are excluded by index — decided once by eye,
 * against the labelled debug image this writes alongside.
 */
import sharp from 'sharp';

import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'assets/img/covers/the-blue-bookmark-bookshop-full.jpg');
const OUT = path.join(ROOT, 'assets/img/wordmark');

// Blossom petals and a leaf tip, identified once against wordmark-debug.png.
// Run with DROP= to see every component boxed and numbered, then set this.
const DROP = new Set((process.env.DROP || '2,3,21,28,29,32,33,34').split(',').filter(Boolean).map(Number));

// Override while tuning:  CROP=left,top,width,height node tools/extract-wordmark.mjs
const CROP = (() => {
  const e = (process.env.CROP || '').split(',').map(Number);
  return e.length === 4 && e.every((n) => Number.isFinite(n))
    ? { left: e[0], top: e[1], width: e[2], height: e[3] }
    : { left: 120, top: 14, width: 850, height: 410 };
})();

const { data, info } = await sharp(SRC).extract(CROP).ensureAlpha().raw()
  .toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;

const LO = 8, HI = 64;
const alpha = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) {
  const sky = data[i * C + 2] - data[i * C];
  alpha[i] = sky <= LO ? 1 : sky >= HI ? 0 : 1 - (sky - LO) / (HI - LO);
}

const SOLID = 0.55;
const label = new Int32Array(W * H).fill(-1);
const comps = [];
const stack = [];
for (let p = 0; p < W * H; p++) {
  if (label[p] !== -1 || alpha[p] < SOLID) continue;
  const id = comps.length;
  let n = 0, x0 = W, y0 = H, x1 = 0, y1 = 0, sr = 0, sg = 0, sb = 0;
  stack.push(p); label[p] = id;
  while (stack.length) {
    const q = stack.pop(); n++;
    const x = q % W, y = (q / W) | 0;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
    sr += data[q * C]; sg += data[q * C + 1]; sb += data[q * C + 2];
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const r = ny * W + nx;
      if (label[r] === -1 && alpha[r] >= SOLID) { label[r] = id; stack.push(r); }
    }
  }
  comps.push({ id, n, x0, y0, x1, y1, w: x1-x0+1, h: y1-y0+1,
               r: Math.round(sr/n), g: Math.round(sg/n), b: Math.round(sb/n) });
}

// Specks are never letters; everything else is a judgement call made by index.
const keep = comps.map((c) => c.n >= 120 && !DROP.has(c.id));
console.log(`components: ${comps.length}, kept: ${keep.filter(Boolean).length}`);
for (const c of comps) {
  if (c.n < 120) continue;
  const hex = '#' + [c.r,c.g,c.b].map(v=>v.toString(16).padStart(2,'0')).join('');
  console.log(`  [${String(c.id).padStart(2)}] ${String(c.n).padStart(5)}px  ` +
    `${String(c.w).padStart(3)}x${String(c.h).padStart(3)}  at ${String(c.x0).padStart(3)},${String(c.y0).padStart(3)}  ` +
    `${hex}  ${keep[c.id] ? 'keep' : 'DROP'}`);
}

function nearKept(i) {
  const x = i % W, y = (i / W) | 0;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    const l = label[ny * W + nx];
    if (l !== -1 && keep[l]) return true;
  }
  return false;
}

/* ---- close the speckle holes ----------------------------------------------
   The brush let sky show through inside some strokes. Those pixels key out as
   semi-transparent, so on a dark ground they read as holes in the letter — the
   'e' of Blue worst of all. Find every not-solid region that does NOT touch the
   border: small ones are speckles and get filled from the nearest ink pixel,
   large ones are the counters of e, o, B, p and must stay open. Run with
   HOLES=report to print the sizes before choosing the cut. */
const HOLE_MAX = Number(process.env.HOLE_MAX || 60);
{
  const seen = new Int32Array(W * H).fill(-1);
  const regions = [];
  const st = [];
  for (let p0 = 0; p0 < W * H; p0++) {
    if (seen[p0] !== -1 || alpha[p0] >= SOLID) continue;
    const id = regions.length;
    let n = 0, touchesBorder = false;
    const px = [];
    st.push(p0); seen[p0] = id;
    while (st.length) {
      const q = st.pop(); n++; px.push(q);
      const x = q % W, y = (q / W) | 0;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) touchesBorder = true;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const r = ny * W + nx;
        if (seen[r] === -1 && alpha[r] < SOLID) { seen[r] = id; st.push(r); }
      }
    }
    regions.push({ id, n, touchesBorder, px });
  }
  const enclosed = regions.filter((r) => !r.touchesBorder).sort((a, b) => a.n - b.n);
  if (process.env.HOLES === 'report') {
    console.log(`enclosed regions (${enclosed.length}) by size:`);
    console.log('  ' + enclosed.map((r) => r.n).join(', '));
  }
  let filled = 0;
  for (const r of enclosed) {
    if (r.n > HOLE_MAX) continue;        // a letter counter, leave it open
    for (const q of r.px) {
      alpha[q] = 1;
      // Take colour from the nearest solid ink pixel so the fill matches the
      // brush around it rather than inventing a flat patch.
      const x = q % W, y = (q / W) | 0;
      let best = null;
      for (let rad = 1; rad <= 6 && !best; rad++) {
        for (let dy = -rad; dy <= rad && !best; dy++) {
          for (let dx = -rad; dx <= rad && !best; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const t = ny * W + nx;
            if (alpha[t] >= SOLID && seen[t] === -1) best = t;
          }
        }
      }
      if (best !== null) {
        data[q * C] = data[best * C];
        data[q * C + 1] = data[best * C + 1];
        data[q * C + 2] = data[best * C + 2];
      }
    }
    filled++;
  }
  console.log(`speckle holes filled: ${filled} (kept ${enclosed.length - filled} counters open)`);
}

const out = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) {
  const l = label[i];
  const live = l !== -1 ? keep[l] : alpha[i] > 0 && nearKept(i);
  // The brush left pale SKY-COLOURED speckles inside the strokes. Against the
  // cover's own bright sky they vanish; against a deep cobalt they read as
  // holes in the letter — most visibly in the 'e' of Blue. Both real ink
  // colours (cream and pink) have blue at or below red, so clamping blue down
  // to red kills the cast and leaves the brush's light-and-dark intact.
  let r = data[i*C], g = data[i*C+1], b = data[i*C+2];
  if (b > r) { const cast = b - r; b = r; g = Math.max(r, g - Math.round(cast * 0.55)); }
  out[i*4] = r; out[i*4+1] = g; out[i*4+2] = b;
  out[i*4+3] = live ? Math.round(alpha[i] * 255) : 0;
}

await sharp(out, { raw: { width: W, height: H, channels: 4 } })
  .trim({ threshold: 1 }).png().toFile(`${OUT}/blue-bookmark-bookshop-776.png`);
const m = await sharp(`${OUT}/blue-bookmark-bookshop-776.png`).metadata();
console.log('wordmark:', m.width + 'x' + m.height);

// Debug sheet: every surviving component boxed and numbered, on the real sky
// colour, so the petals can be identified by index.
const boxes = comps.filter(c => c.n >= 120).map(c =>
  `<rect x="${c.x0}" y="${c.y0}" width="${c.w}" height="${c.h}" fill="none" stroke="#ff0044" stroke-width="2"/>` +
  `<text x="${c.x0+2}" y="${c.y0-3}" font-family="Helvetica" font-size="17" fill="#ff0044">${c.id}</text>`).join('');
await sharp(await sharp(SRC).extract(CROP).png().toBuffer())
  .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${boxes}</svg>`) }])
  .png().toFile(path.join(ROOT, 'tools/wordmark-debug.png'));

// The lettering is cream and pink, lifted from a blue sky: it only reads on a
// dark ground. Never place it on paper.
await sharp(`${OUT}/blue-bookmark-bookshop-776.png`)
  .resize({ width: 400, kernel: 'lanczos3' })
  .png({ compressionLevel: 9 }).toFile(`${OUT}/blue-bookmark-bookshop-400.png`);
for (const w of [400, 776]) {
  await sharp(`${OUT}/blue-bookmark-bookshop-${w}.png`)
    .webp({ quality: 92, effort: 6, alphaQuality: 100 })
    .toFile(`${OUT}/blue-bookmark-bookshop-${w}.webp`);
}
console.log('wordmark written to assets/img/wordmark/');
