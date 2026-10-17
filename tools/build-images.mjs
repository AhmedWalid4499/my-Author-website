/**
 * Regenerate the responsive cover derivatives.
 *
 * Masters (committed, treated as the source of truth):
 *   assets/img/covers/<slug>-full.jpg     900×1436
 *
 * Run:  node tools/build-images.mjs
 */
import sharp from 'sharp';
import path from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COVERS = path.join(ROOT, 'assets/img/covers');

// Slugs come from books.json so adding a book is a data-only change.
const SLUGS = JSON.parse(readFileSync(path.join(ROOT, 'tools/books.json'), 'utf8'))
  .books.map((b) => b.slug);
const COVER_WIDTHS = [300, 450, 600, 900];

for (const slug of SLUGS) {
  const master = path.join(COVERS, `${slug}-full.jpg`);
  for (const w of COVER_WIDTHS) {
    const base = sharp(master).resize({ width: w, withoutEnlargement: true });
    await base.clone().webp({ quality: 82, effort: 6 }).toFile(path.join(COVERS, `${slug}-${w}.webp`));
    await base.clone().jpeg({ quality: 82, mozjpeg: true, progressive: true }).toFile(path.join(COVERS, `${slug}-${w}.jpg`));
  }
  console.log(`covers  ${slug}`);
}

