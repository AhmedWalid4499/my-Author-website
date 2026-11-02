/**
 * Shared ARC plumbing: campaign and reader IO, and the MIME builder.
 *
 * build.mjs (files) and panel.mjs (UI + send) both go through here, so the
 * message you preview, the .eml you inspect and the mail that actually leaves
 * are assembled by the same code from the same bytes.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import * as template from './template.mjs';
import { composeMessage, EMAIL_RE as SHARED_EMAIL_RE } from '../mail.mjs';

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

export const EMAIL_RE = SHARED_EMAIL_RE;

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

/**
 * The advance-copy letter as one complete message.
 *
 * The assembly itself lives in tools/mail.mjs, which the admin panel uses too,
 * so a message built here and a message built there are built by the same
 * code. What is particular to this letter — the hero attached inline, the EPUB
 * hanging off the end — is just what gets handed over.
 */
export function buildMessage(c, reader, assets) {
  return composeMessage({
    from: c.from,
    to: { name: reader.name, email: reader.email },
    replyTo: c.replyTo,
    subject: template.subject(c),
    text: template.text(c, reader),
    html: template.html(c, reader),
    inline: [{ cid: 'hero', filename: 'bookshop.jpg', mime: assets.heroMime, buf: assets.hero }],
    attachments: assets.epub
      ? [{ filename: assets.epub.name, mime: 'application/epub+zip', buf: assets.epub.buf }]
      : [],
  });
}
