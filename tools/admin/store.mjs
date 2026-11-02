/**
 * Where the admin panel keeps things.
 *
 *   contacts.csv   the people you write to — name, email, groups, note
 *   drafts.json    letters you have written but not sent
 *   history.json   what went out, to whom, and when
 *
 * All three are plain files next to this one, all three are git-ignored, and
 * contacts.csv is deliberately a CSV so you can open it in Numbers or Excel
 * and edit it there without the panel running.
 */
import { readFileSync, writeFileSync, existsSync, renameSync, mkdirSync } from 'fs';
import path from 'path';

/* ------------------------------------------------------------------- csv */

/** RFC 4180 enough: quoted fields, doubled quotes inside them, CRLF or LF. */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += ch;
    } else if (ch === '"') quoted = true;
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

const csvField = (v) => {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/* -------------------------------------------------------------- contacts */

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Groups are a free-text field: "arc, press" in the CSV, an array in here. */
const splitGroups = (s) =>
  String(s || '').split(/[;,]/).map((g) => g.trim().toLowerCase()).filter(Boolean);

export function readContacts(here) {
  const file = path.join(here, 'contacts.csv');
  if (!existsSync(file)) return [];
  const seen = new Set();
  return parseCsv(readFileSync(file, 'utf8'))
    .map((r) => ({
      name: r.name || '',
      email: (r.email || '').trim(),
      groups: splitGroups(r.groups),
      note: r.note || '',
    }))
    .filter((c) => c.email)
    .map((c) => {
      const key = c.email.toLowerCase();
      const duplicate = seen.has(key);
      seen.add(key);
      return { ...c, valid: EMAIL_RE.test(c.email), duplicate };
    });
}

/**
 * Write the list back.
 *
 * Via a temporary file and a rename, because this is the only copy of a list
 * the owner typed by hand: a crash halfway through a plain write would leave
 * it truncated, and nothing else in this repo has a backup of it.
 */
export function writeContacts(here, contacts) {
  const rows = contacts
    .filter((c) => (c.email || '').trim())
    .map((c) => [
      csvField((c.name || '').trim()),
      csvField(c.email.trim()),
      csvField((Array.isArray(c.groups) ? c.groups : splitGroups(c.groups)).join('; ')),
      csvField((c.note || '').trim()),
    ].join(','));

  const file = path.join(here, 'contacts.csv');
  const tmp = file + '.tmp';
  writeFileSync(tmp, 'name,email,groups,note\n' + rows.join('\n') + '\n');
  renameSync(tmp, file);
  return rows.length;
}

/** Every group in use, with how many people are in it. */
export function groupsOf(contacts) {
  const counts = new Map();
  for (const c of contacts) for (const g of c.groups) counts.set(g, (counts.get(g) || 0) + 1);
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));
}

/** No group selected means everyone; otherwise anyone in any of them. */
export function selectContacts(contacts, groups) {
  const wanted = (groups || []).map((g) => g.toLowerCase()).filter(Boolean);
  const live = contacts.filter((c) => c.valid && !c.duplicate);
  if (!wanted.length) return live;
  return live.filter((c) => c.groups.some((g) => wanted.includes(g)));
}

/* ---------------------------------------------------------------- drafts */

const jsonFile = (here, name, fallback) => {
  const file = path.join(here, name);
  if (!existsSync(file)) return fallback;
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return fallback; }
};

const writeJson = (here, name, value) => {
  const file = path.join(here, name);
  writeFileSync(file + '.tmp', JSON.stringify(value, null, 2) + '\n');
  renameSync(file + '.tmp', file);
};

export const readDrafts = (here) => jsonFile(here, 'drafts.json', []);

export function saveDraft(here, draft) {
  const drafts = readDrafts(here);
  const at = drafts.findIndex((d) => d.id === draft.id);
  if (at === -1) drafts.unshift(draft); else drafts[at] = draft;
  writeJson(here, 'drafts.json', drafts.slice(0, 50));
  return drafts;
}

export function deleteDraft(here, id) {
  const drafts = readDrafts(here).filter((d) => d.id !== id);
  writeJson(here, 'drafts.json', drafts);
  return drafts;
}

/* --------------------------------------------------------------- history */

export const readHistory = (here) => jsonFile(here, 'history.json', []);

/**
 * Record a send. Keeps the recipients, so before sending the same letter again
 * the panel can tell you who has already had it — the mistake that is easiest
 * to make and most embarrassing to explain.
 */
export function recordSend(here, entry) {
  const history = readHistory(here);
  history.unshift(entry);
  writeJson(here, 'history.json', history.slice(0, 200));
  return history;
}

/** Everyone who has ever been sent a letter with this subject. */
export function alreadySent(here, subject) {
  const key = String(subject || '').trim().toLowerCase();
  if (!key) return new Set();
  const seen = new Set();
  for (const h of readHistory(here)) {
    if (String(h.subject || '').trim().toLowerCase() !== key) continue;
    for (const r of h.recipients || []) seen.add(String(r).toLowerCase());
  }
  return seen;
}

/* ----------------------------------------------------------------- setup */

/** First run: start the contact list from the ARC reader list, if there is one. */
export function seedFromArc(here, arcDir) {
  if (existsSync(path.join(here, 'contacts.csv'))) return null;
  const readers = path.join(arcDir, 'readers.csv');
  if (!existsSync(readers)) return null;
  const rows = parseCsv(readFileSync(readers, 'utf8'))
    .filter((r) => (r.email || '').trim())
    .map((r) => ({ name: r.name || '', email: r.email.trim(), groups: ['arc'], note: '' }));
  if (!rows.length) return null;
  mkdirSync(here, { recursive: true });
  writeContacts(here, rows);
  return rows.length;
}
