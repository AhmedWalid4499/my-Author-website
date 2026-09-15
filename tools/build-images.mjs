/**
 * Regenerate the responsive cover and portrait derivatives.
 *
 * Masters (committed, treated as the source of truth):
 *   assets/img/covers/<slug>-full.jpg     900×1436
 *   assets/img/author/ahmed-el-bourgy-full.jpg
 *
 * Run:  node tools/build-images.mjs
 */
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COVERS = path.join(ROOT, 'assets/img/covers');
const AUTHOR = path.join(ROOT, 'assets/img/author');

const SLUGS = ['from-tomorrow', 'sakura-slice-cafe', 'the-perfect-sunrise'];
const COVER_WIDTHS = [300, 450, 600, 900];
const PORTRAIT_WIDTHS = [320, 480, 720];

for (const slug of SLUGS) {
  const master = path.join(COVERS, `${slug}-full.jpg`);
  for (const w of COVER_WIDTHS) {
    const base = sharp(master).resize({ width: w, withoutEnlargement: true });
    await base.clone().webp({ quality: 82, effort: 6 }).toFile(path.join(COVERS, `${slug}-${w}.webp`));
    await base.clone().jpeg({ quality: 82, mozjpeg: true, progressive: true }).toFile(path.join(COVERS, `${slug}-${w}.jpg`));
  }
  console.log(`covers  ${slug}`);
}

const portrait = path.join(AUTHOR, 'ahmed-el-bourgy-full.jpg');
for (const w of PORTRAIT_WIDTHS) {
  const h = Math.round((w * 4) / 3);
  const base = sharp(portrait).resize({ width: w, height: h, fit: 'cover' });
  await base.clone().webp({ quality: 84, effort: 6 }).toFile(path.join(AUTHOR, `ahmed-el-bourgy-${w}.webp`));
  await base.clone().jpeg({ quality: 84, mozjpeg: true, progressive: true }).toFile(path.join(AUTHOR, `ahmed-el-bourgy-${w}.jpg`));
}
console.log('portrait ahmed-el-bourgy');
