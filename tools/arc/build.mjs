/**
 * Build one ready-to-send email per ARC reader.
 *
 *   node tools/arc/build.mjs                 every reader in readers.csv
 *   node tools/arc/build.mjs --preview       just out/preview.html, no .eml
 *   node tools/arc/build.mjs --one           first reader only, for a test send
 *
 * Output lands in tools/arc/out/ (git-ignored — it holds reader addresses and
 * the unreleased manuscript):
 *
 *   preview.html          the email, openable in a browser
 *   <name>-<email>.eml    one complete message per reader, EPUB attached
 *
 * Sending: open an .eml and send it from your own mail client, so the message
 * leaves your real account and carries your account's own DKIM signature. That
 * signature — not the design of the email — is what actually proves it is you.
 * See README.md.
 *
 * Nothing here sends anything. It only writes files.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'fs';
import path from 'path';
import { randomBytes, createHash } from 'crypto';
import { fileURLToPath } from 'url';
import * as template from './template.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
const argv = process.argv.slice(2);
const PREVIEW_ONLY = argv.includes('--preview');
const ONE = argv.includes('--one');

const c = JSON.parse(readFileSync(path.join(HERE, 'campaign.json'), 'utf8'));

/* ---------------------------------------------------------------- readers */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift().map((h) => h.trim().toLowerCase());
  return rows
    .filter((r) => r.some((v) => v.trim()))
    .map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
}

const readersPath = path.join(HERE, 'readers.csv');
let readers = [];
if (existsSync(readersPath)) {
  readers = parseCsv(readFileSync(readersPath, 'utf8'));
  const bad = readers.filter((r) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email || ''));
  if (bad.length) {
    console.error(`readers.csv: ${bad.length} row(s) without a usable email address:`);
    for (const b of bad) console.error('  ', JSON.stringify(b));
    process.exit(1);
  }
} else if (!PREVIEW_ONLY) {
  console.error('No readers.csv. Copy readers.example.csv to readers.csv and fill it in,\n' +
                'or run with --preview to just look at the email.');
  process.exit(1);
}
if (ONE) readers = readers.slice(0, 1);

/* ---------------------------------------------------------------- assets */
const heroPath = path.resolve(HERE, c.heroImage);
if (!existsSync(heroPath)) { console.error(`Hero image not found: ${heroPath}`); process.exit(1); }
const hero = readFileSync(heroPath);
const heroMime = heroPath.endsWith('.png') ? 'image/png' : 'image/jpeg';

let epub = null;
if (c.epub && c.epub.trim()) {
  const p = path.resolve(HERE, c.epub);
  if (!existsSync(p)) { console.error(`EPUB not found: ${p}\nFix "epub" in campaign.json.`); process.exit(1); }
  epub = { buf: readFileSync(p), name: c.epubFilename || path.basename(p) };
}

/* ---------------------------------------------------------------- MIME */
const CRLF = '\r\n';
const b64 = (buf) => (buf.toString('base64').match(/.{1,76}/g) || []).join(CRLF);
const needsEncoding = (s) => /[^\x20-\x7E]/.test(s);
// RFC 2047, so non-ASCII subjects and names survive every client.
const encodeHeader = (s) =>
  needsEncoding(s) ? `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=` : s;
const address = (name, email) => (name ? `${encodeHeader(name)} <${email}>` : email);
const boundary = (tag) => `----=_${tag}_${randomBytes(12).toString('hex')}`;

function buildEml(reader) {
  const MIX = boundary('mix'), REL = boundary('rel'), ALT = boundary('alt');
  const htmlBody = template.html(c, reader);
  const textBody = template.text(c, reader);
  const domain = c.from.email.split('@')[1] || 'localhost';
  const msgId = `<${Date.now()}.${randomBytes(8).toString('hex')}@${domain}>`;

  const head = [
    `From: ${address(c.from.name, c.from.email)}`,
    `To: ${address(reader.name, reader.email)}`,
    c.replyTo ? `Reply-To: ${c.replyTo}` : null,
    `Subject: ${encodeHeader(template.subject(c))}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: ${msgId}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${MIX}"`,
  ].filter(Boolean).join(CRLF);

  const parts = [];
  parts.push(`--${MIX}`, `Content-Type: multipart/related; boundary="${REL}"`, '');
  parts.push(`--${REL}`, `Content-Type: multipart/alternative; boundary="${ALT}"`, '');

  parts.push(`--${ALT}`, 'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64', '', b64(Buffer.from(textBody, 'utf8')));
  parts.push(`--${ALT}`, 'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64', '', b64(Buffer.from(htmlBody, 'utf8')));
  parts.push(`--${ALT}--`, '');

  parts.push(`--${REL}`, `Content-Type: ${heroMime}; name="bookshop.jpg"`,
    'Content-Transfer-Encoding: base64', 'Content-ID: <hero>',
    'Content-Disposition: inline; filename="bookshop.jpg"', '', b64(hero));
  parts.push(`--${REL}--`, '');

  if (epub) {
    parts.push(`--${MIX}`,
      `Content-Type: application/epub+zip; name="${epub.name}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${epub.name}"`, '', b64(epub.buf));
  }
  parts.push(`--${MIX}--`, '');

  return head + CRLF + CRLF + parts.join(CRLF);
}

/* ---------------------------------------------------------------- write */
mkdirSync(OUT, { recursive: true });

const sample = readers[0] || { name: 'Mina Tanaka', email: 'reader@example.com' };
// The preview inlines the hero as a data URI rather than pointing at the file,
// so preview.html is self-contained and can be opened or forwarded anywhere.
writeFileSync(
  path.join(OUT, 'preview.html'),
  template.html(c, sample).replace(
    'src="cid:hero"',
    `src="data:${heroMime};base64,${hero.toString('base64')}"`
  )
);
writeFileSync(path.join(OUT, 'preview.txt'), template.text(c, sample));

console.log(`campaign : ${c.titlePlain}`);
console.log(`subject  : ${template.subject(c)}`);
console.log(`hero     : ${(hero.length / 1024).toFixed(0)} KB`);
console.log(`epub     : ${epub ? `${epub.name} (${(epub.buf.length / 1024 / 1024).toFixed(2)} MB)` : 'NOT SET — emails will go out with no book attached'}`);
if (!c.releaseDate) console.log('warning  : releaseDate is empty, the email will say "soon"');
if (!c.reviewBy)    console.log('warning  : reviewBy is empty, the email will not name a deadline');
console.log(`preview  : ${path.join('tools/arc/out', 'preview.html')}`);

if (PREVIEW_ONLY) { console.log('\n--preview: no .eml written.'); process.exit(0); }

let total = 0;
for (const r of readers) {
  const eml = buildEml(r);
  const slug = (r.name || r.email).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const file = `${slug}-${createHash('sha1').update(r.email).digest('hex').slice(0, 6)}.eml`;
  writeFileSync(path.join(OUT, file), eml, 'utf8');
  total += Buffer.byteLength(eml);
}

if (readers.length) {
  const each = total / readers.length / 1024 / 1024;
  console.log(`\nwrote ${readers.length} .eml file(s) to tools/arc/out/ — ${each.toFixed(2)} MB each`);
  if (each > 20) console.log('warning  : over 20 MB per message; many providers will bounce these.');
  console.log('Open one, check it, then send them from your own mail client.');
}
