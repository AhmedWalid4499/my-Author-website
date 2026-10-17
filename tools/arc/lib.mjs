/**
 * Shared ARC plumbing: campaign and reader IO, and the MIME builder.
 *
 * build.mjs (files) and panel.mjs (UI + send) both go through here, so the
 * message you preview, the .eml you inspect and the mail that actually leaves
 * are assembled by the same code from the same bytes.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import * as template from './template.mjs';

/* ----------------------------------------------------------- campaign */
export const readCampaign = (here) =>
  JSON.parse(readFileSync(path.join(here, 'campaign.json'), 'utf8'));

export function writeCampaign(here, patch) {
  const file = path.join(here, 'campaign.json');
  const current = JSON.parse(readFileSync(file, 'utf8'));
  // Only the fields the panel owns; everything else stays as written.
  for (const k of ['subject', 'releaseDate', 'reviewBy', 'epub', 'epubFilename', 'replyTo']) {
    if (k in patch) current[k] = patch[k];
  }
  if (patch.from && typeof patch.from === 'object') {
    current.from = { ...current.from, ...patch.from };
  }
  writeFileSync(file, JSON.stringify(current, null, 2) + '\n');
  return current;
}

/* ------------------------------------------------------------ readers */
export function parseCsv(text) {
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
  if (!rows.length) return [];
  const head = rows.shift().map((h) => h.trim().toLowerCase());
  return rows
    .filter((r) => r.some((v) => v.trim()))
    .map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
}

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function readReaders(here) {
  const f = path.join(here, 'readers.csv');
  if (!existsSync(f)) return [];
  return parseCsv(readFileSync(f, 'utf8'))
    .map((r) => ({ name: r.name || '', email: r.email || '', valid: EMAIL_RE.test(r.email || '') }));
}

export function writeReaders(here, readers) {
  const rows = readers
    .filter((r) => (r.email || '').trim())
    .map((r) => {
      const name = (r.name || '').trim();
      const quoted = name.includes(',') || name.includes('"')
        ? `"${name.replace(/"/g, '""')}"` : name;
      return `${quoted},${r.email.trim()}`;
    });
  writeFileSync(path.join(here, 'readers.csv'), 'name,email\n' + rows.join('\n') + '\n');
  return rows.length;
}

/* ------------------------------------------------------------- assets */
export function loadAssets(here, campaign) {
  const heroPath = path.resolve(here, campaign.heroImage);
  if (!existsSync(heroPath)) throw new Error(`Hero image not found: ${heroPath}`);
  const hero = readFileSync(heroPath);
  const heroMime = heroPath.endsWith('.png') ? 'image/png' : 'image/jpeg';

  let epub = null;
  if (campaign.epub && campaign.epub.trim()) {
    const p = path.resolve(here, campaign.epub);
    if (!existsSync(p)) throw new Error(`EPUB not found: ${p}`);
    epub = { buf: readFileSync(p), name: campaign.epubFilename || path.basename(p) };
  }
  return { hero, heroMime, epub };
}

/* --------------------------------------------------------------- mime */
const CRLF = '\r\n';
const b64 = (buf) => (buf.toString('base64').match(/.{1,76}/g) || []).join(CRLF);
const needsEncoding = (s) => /[^\x20-\x7E]/.test(s);
const encodeHeader = (s) =>
  needsEncoding(s) ? `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=` : s;
const address = (name, email) => (name ? `${encodeHeader(name)} <${email}>` : email);
const boundary = (tag) => `----=_${tag}_${randomBytes(12).toString('hex')}`;

/**
 * One complete RFC 822 message.
 *
 *   multipart/mixed
 *   ├── multipart/related
 *   │   ├── multipart/alternative
 *   │   │   ├── text/plain
 *   │   │   └── text/html
 *   │   └── image/jpeg  (Content-ID: hero, inline)
 *   └── application/epub+zip  (attachment)
 */
export function buildMessage(c, reader, assets) {
  const MIX = boundary('mix'), REL = boundary('rel'), ALT = boundary('alt');
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
    'Content-Transfer-Encoding: base64', '', b64(Buffer.from(template.text(c, reader), 'utf8')));
  parts.push(`--${ALT}`, 'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64', '', b64(Buffer.from(template.html(c, reader), 'utf8')));
  parts.push(`--${ALT}--`, '');
  parts.push(`--${REL}`, `Content-Type: ${assets.heroMime}; name="bookshop.jpg"`,
    'Content-Transfer-Encoding: base64', 'Content-ID: <hero>',
    'Content-Disposition: inline; filename="bookshop.jpg"', '', b64(assets.hero));
  parts.push(`--${REL}--`, '');
  if (assets.epub) {
    parts.push(`--${MIX}`,
      `Content-Type: application/epub+zip; name="${assets.epub.name}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${assets.epub.name}"`, '', b64(assets.epub.buf));
  }
  parts.push(`--${MIX}--`, '');

  return head + CRLF + CRLF + parts.join(CRLF);
}
