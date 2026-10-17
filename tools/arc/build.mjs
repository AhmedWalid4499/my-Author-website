/**
 * Build one ready-to-send email per ARC reader.
 *
 *   node arc/build.mjs                 every reader in readers.csv
 *   node arc/build.mjs --preview       just out/preview.html, no .eml
 *   node arc/build.mjs --one           first reader only, for a test send
 *
 * For a UI with a live preview and a send button, use the panel instead:
 *
 *   npm run arc
 *
 * Output lands in tools/arc/out/ (git-ignored — it holds reader addresses and
 * the unreleased manuscript). Nothing here sends anything; it writes files.
 * See README.md for why sending from your own account is the part that proves
 * the mail came from you.
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import * as template from './template.mjs';
import { readCampaign, readReaders, loadAssets, buildMessage } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
const argv = process.argv.slice(2);
const PREVIEW_ONLY = argv.includes('--preview');
const ONE = argv.includes('--one');

const c = readCampaign(HERE);
let readers = readReaders(HERE);

const bad = readers.filter((r) => !r.valid);
if (bad.length) {
  console.error(`readers.csv: ${bad.length} row(s) without a usable email address:`);
  for (const b of bad) console.error('  ', JSON.stringify({ name: b.name, email: b.email }));
  process.exit(1);
}
if (!readers.length && !PREVIEW_ONLY) {
  console.error('No readers.csv. Copy readers.example.csv to readers.csv and fill it in,\n' +
                'or run with --preview to just look at the email.');
  process.exit(1);
}
if (ONE) readers = readers.slice(0, 1);

const assets = loadAssets(HERE, c);

mkdirSync(OUT, { recursive: true });

const sample = readers[0] || { name: 'Mina Tanaka', email: 'reader@example.com' };
// The preview inlines the hero as a data URI rather than pointing at the file,
// so preview.html is self-contained and can be opened or forwarded anywhere.
writeFileSync(path.join(OUT, 'preview.html'),
  template.html(c, sample).replace('src="cid:hero"',
    `src="data:${assets.heroMime};base64,${assets.hero.toString('base64')}"`));
writeFileSync(path.join(OUT, 'preview.txt'), template.text(c, sample));

console.log(`campaign : ${c.titlePlain}`);
console.log(`subject  : ${template.subject(c)}`);
console.log(`hero     : ${(assets.hero.length / 1024).toFixed(0)} KB`);
console.log(`epub     : ${assets.epub
  ? `${assets.epub.name} (${(assets.epub.buf.length / 1048576).toFixed(2)} MB)`
  : 'NOT SET — emails will go out with no book attached'}`);
if (!c.releaseDate) console.log('warning  : releaseDate is empty, the email will say "soon"');
if (!c.reviewBy)    console.log('warning  : reviewBy is empty, the email will not name a deadline');
console.log(`preview  : tools/arc/out/preview.html`);

if (PREVIEW_ONLY) { console.log('\n--preview: no .eml written.'); process.exit(0); }

let total = 0;
for (const r of readers) {
  const raw = buildMessage(c, r, assets);
  const slug = (r.name || r.email).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const file = `${slug}-${createHash('sha1').update(r.email).digest('hex').slice(0, 6)}.eml`;
  writeFileSync(path.join(OUT, file), raw, 'utf8');
  total += Buffer.byteLength(raw);
}

if (readers.length) {
  const each = total / readers.length / 1048576;
  console.log(`\nwrote ${readers.length} .eml file(s) to tools/arc/out/ — ${each.toFixed(2)} MB each`);
  if (each > 20) console.log('warning  : over 20 MB per message; many providers will bounce these.');
  console.log('Open one, check it, then send them from your own mail client.');
}
