/**
 * The admin panel — your own page for writing to your readers.
 *
 *   cd tools && npm run admin
 *
 * Then open http://127.0.0.1:8899.
 *
 * WHY IT IS NOT ON THE WEBSITE
 * The site is static files on GitHub Pages. There is no server behind it, so
 * it cannot send mail, hold your contact list, or keep a password. And a
 * send-mail page on a public URL would let anyone who found it write to your
 * readers as you. So this runs on your own machine instead: it binds to
 * 127.0.0.1, which means nothing else on your network can reach it, and it is
 * gone the moment you close the terminal.
 *
 * Your Gmail app password is typed into the page, used for the length of one
 * send, and never written to disk or into the repo.
 */
import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';

import { composeMessage, sendAll, verifyLogin, EMAIL_RE } from '../mail.mjs';
import * as letter from './letter.mjs';
import * as store from './store.mjs';
import * as arcTemplate from '../arc/template.mjs';
import { readCampaign, writeCampaign, loadAssets } from '../arc/lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ARC = path.join(HERE, '..', 'arc');
const OUT = path.join(HERE, 'out');
const PORT = Number(process.env.ADMIN_PORT || 8899);

/**
 * Any page open in your browser can reach 127.0.0.1. This token, printed only
 * in your terminal and dropped into the page when it is served, is what stops
 * one of them from quietly firing off a send in the background.
 */
const TOKEN = randomBytes(16).toString('hex');

const log = [];
const note = (m) => {
  log.push(`${new Date().toISOString().slice(11, 19)}  ${m}`);
  console.log('  ' + m);
};

const SITE = {
  author: 'Ahmed El-Bourgy',
  place: 'Cairo',
  siteUrl: 'https://ahmedwalid4499.github.io/my-Author-website/',
};

/* ----------------------------------------------------------------- state */

function state() {
  const contacts = store.readContacts(HERE);
  let campaign = null;
  try {
    const c = readCampaign(ARC);
    let epub = null;
    if (c.epub && c.epub.trim()) {
      const abs = path.resolve(ARC, c.epub);
      epub = existsSync(abs)
        ? { ok: true, path: abs, mb: +(statSync(abs).size / 1048576).toFixed(2) }
        : { ok: false, path: abs };
    }
    campaign = { ...c, epubStatus: epub };
  } catch (e) {
    note(`Could not read the ARC campaign: ${e.message}`);
  }

  return {
    contacts,
    groups: store.groupsOf(contacts),
    drafts: store.readDrafts(HERE),
    history: store.readHistory(HERE).slice(0, 40),
    campaign,
    site: SITE,
    log: log.slice(-200),
  };
}

/* --------------------------------------------------------------- letters */

/**
 * One place that turns "what the panel is showing" into "the bytes that leave".
 *
 * Both kinds of letter come through here — the advance-copy letter with its
 * own template and the EPUB, and anything written in the panel — so the
 * preview, the .eml files and the sent mail can never drift apart.
 */
function buildFor(kind, draft, reader) {
  const to = { name: reader.name || '', email: reader.email };

  if (kind === 'arc') {
    const c = readCampaign(ARC);
    const assets = loadAssets(ARC, c);
    return {
      subject: arcTemplate.subject(c),
      raw: composeMessage({
        from: c.from,
        to,
        replyTo: c.replyTo,
        subject: arcTemplate.subject(c),
        text: arcTemplate.text(c, to),
        html: arcTemplate.html(c, to),
        inline: [{ cid: 'hero', filename: 'bookshop.jpg', mime: assets.heroMime, buf: assets.hero }],
        attachments: assets.epub
          ? [{ filename: assets.epub.name, mime: 'application/epub+zip', buf: assets.epub.buf }]
          : [],
      }),
      envelopeFrom: c.from.email,
    };
  }

  // A letter with no From is not a letter: it fails at the SMTP door, and an
  // .eml with an empty address is simply broken. The advance-copy campaign
  // already knows who you are, so that is the default, and anything still
  // empty stops here rather than at send time.
  let from = draft.from && draft.from.email ? draft.from : null;
  if (!from) {
    try {
      const c = readCampaign(ARC);
      if (c.from && c.from.email) from = c.from;
    } catch { /* no campaign; fall through to the error below */ }
  }
  if (!from || !EMAIL_RE.test(from.email || '')) {
    throw new Error('Who is it from? Put your address in the "From address" field.');
  }
  const inline = [];
  const attachments = [];

  if (draft.image && draft.image.trim()) {
    const p = path.resolve(HERE, draft.image.trim());
    if (!existsSync(p)) throw new Error(`Picture not found: ${p}`);
    inline.push({
      cid: 'hero',
      filename: path.basename(p),
      mime: p.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
      buf: readFileSync(p),
    });
  }
  for (const f of draft.files || []) {
    const p = path.resolve(HERE, String(f).trim());
    if (!existsSync(p)) throw new Error(`Attachment not found: ${p}`);
    attachments.push({
      filename: path.basename(p),
      mime: mimeOf(p),
      buf: readFileSync(p),
    });
  }

  const opts = { ...SITE, eyebrow: draft.eyebrow, heroCid: inline.length ? 'hero' : null,
                 heroAlt: draft.imageAlt || '' };

  return {
    subject: letter.fill(draft.subject, to),
    raw: composeMessage({
      from,
      to,
      replyTo: draft.replyTo || from.email,
      subject: letter.fill(draft.subject, to),
      text: letter.text(draft, to, opts),
      html: letter.html(draft, to, opts),
      inline,
      attachments,
    }),
    envelopeFrom: from.email,
  };
}

const MIME = {
  '.epub': 'application/epub+zip',
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.zip': 'application/zip', '.txt': 'text/plain', '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};
const mimeOf = (p) => MIME[path.extname(p).toLowerCase()] || 'application/octet-stream';

/** The reader a preview is addressed to: the first real contact, or a stand-in. */
const sampleReader = (contacts) =>
  contacts.find((c) => c.valid && !c.duplicate) || { name: 'Mina Tanaka', email: 'reader@example.com' };

/* ------------------------------------------------------------------ send */

async function doSend({ kind, draft, user, pass, only, groups, dryRun, skipSent }) {
  const contacts = store.readContacts(HERE);
  const recipients = only
    ? [{ name: 'Test', email: only, valid: EMAIL_RE.test(only), groups: [] }]
    : store.selectContacts(contacts, groups);

  if (!recipients.length) throw new Error('Nobody selected. Pick a group, or add contacts first.');
  const bad = recipients.filter((r) => !r.valid);
  if (bad.length) throw new Error(`Not an address: ${bad.map((b) => b.email).join(', ')}`);

  const subject = kind === 'arc' ? arcTemplate.subject(readCampaign(ARC)) : draft.subject;
  let list = recipients;
  let skipped = [];
  if (skipSent && !only) {
    const had = store.alreadySent(HERE, subject);
    skipped = recipients.filter((r) => had.has(r.email.toLowerCase()));
    list = recipients.filter((r) => !had.has(r.email.toLowerCase()));
    if (skipped.length) note(`Skipping ${skipped.length} who already had "${subject}".`);
  }
  if (!list.length) throw new Error('Everyone selected has already had this letter.');

  if (dryRun) {
    note(`Dry run — ${list.length} message(s) would go out as ${user || '(no account yet)'}:`);
    for (const r of list) note(`    would send to ${r.name ? r.name + ' <' + r.email + '>' : r.email}`);
    return { dryRun: true, count: list.length, skipped: skipped.length, sent: 0 };
  }

  const messages = list.map((r) => {
    const built = buildFor(kind, draft, r);
    return { to: r, raw: built.raw, envelopeFrom: built.envelopeFrom };
  });

  note(`Signing in to Gmail as ${user}…`);
  const result = await sendAll({
    user, pass, messages,
    onProgress: (p) => note(p.ok
      ? `sent ${p.sent}/${p.total} → ${p.to.email}`
      : `FAILED → ${p.to.email}: ${p.error}`),
  });

  store.recordSend(HERE, {
    at: new Date().toISOString(),
    kind,
    subject,
    sent: result.sent,
    failed: result.failures.length,
    recipients: list.map((r) => r.email),
    failures: result.failures.map((f) => ({ email: f.to.email, error: f.error })),
  });

  note(result.failures.length
    ? `Done: ${result.sent} sent, ${result.failures.length} failed.`
    : `Done: ${result.sent} sent.`);
  return { ...result, dryRun: false, count: list.length, skipped: skipped.length };
}

/* -------------------------------------------------------------------- ui */

const PAGE = () => readFileSync(path.join(HERE, 'app.html'), 'utf8').replace('__TOKEN__', TOKEN);

const json = (res, code, value) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', (d) => { b += d; if (b.length > 8e6) req.destroy(); });
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch (e) { reject(e); } });
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  try {
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(PAGE());
    }
    if (req.method === 'GET' && url.pathname === '/api/state') return json(res, 200, state());

    if (req.method === 'POST') {
      const b = await readBody(req);
      if (b.token !== TOKEN) return json(res, 403, { error: 'Stale page. Reload it.' });

      // Previewing is a POST because a letter is easily longer than a URL may
      // be, and the HTML comes back as a string for srcdoc rather than as a
      // page the iframe fetches — so what you look at is built from exactly
      // the fields on screen, with nothing cached in between.
      if (url.pathname === '/api/preview') {
        const who = b.to && b.to.email ? b.to : sampleReader(store.readContacts(HERE));
        let html;
        if (b.kind === 'arc') {
          const c = readCampaign(ARC);
          const assets = loadAssets(ARC, c);
          html = arcTemplate.html(c, who).replace('src="cid:hero"',
            `src="data:${assets.heroMime};base64,${assets.hero.toString('base64')}"`);
        } else {
          const draft = b.draft || {};
          let heroCid = null, heroData = null;
          if (draft.image && draft.image.trim()) {
            const p = path.resolve(HERE, draft.image.trim());
            if (!existsSync(p)) throw new Error(`Picture not found: ${p}`);
            heroCid = 'hero';
            heroData = `data:${p.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'};base64,`
              + readFileSync(p).toString('base64');
          }
          html = letter.html(draft, who, { ...SITE, eyebrow: draft.eyebrow, heroCid,
                                           heroAlt: draft.imageAlt || '' });
          if (heroData) html = html.replace('src="cid:hero"', `src="${heroData}"`);
        }
        return json(res, 200, { html, to: who });
      }

      if (url.pathname === '/api/text-preview') {
        const who = sampleReader(store.readContacts(HERE));
        const text = b.kind === 'arc'
          ? arcTemplate.text(readCampaign(ARC), who)
          : letter.text(b.draft || {}, who, SITE);
        return json(res, 200, { text });
      }

      if (url.pathname === '/api/contacts') {
        const n = store.writeContacts(HERE, b.contacts || []);
        note(`Contacts saved — ${n} ${n === 1 ? 'person' : 'people'}.`);
        return json(res, 200, state());
      }
      if (url.pathname === '/api/draft') {
        store.saveDraft(HERE, b.draft);
        return json(res, 200, state());
      }
      if (url.pathname === '/api/draft-delete') {
        store.deleteDraft(HERE, b.id);
        return json(res, 200, state());
      }
      if (url.pathname === '/api/campaign') {
        writeCampaign(ARC, b.campaign);
        note('Advance-copy campaign saved.');
        return json(res, 200, state());
      }
      if (url.pathname === '/api/login') {
        await verifyLogin({ user: b.user, pass: b.pass });
        note(`Gmail accepted ${b.user}.`);
        return json(res, 200, { ok: true, log: log.slice(-200) });
      }
      if (url.pathname === '/api/build') {
        const contacts = store.selectContacts(store.readContacts(HERE), b.groups);
        if (!contacts.length) throw new Error('Nobody selected.');
        mkdirSync(OUT, { recursive: true });
        let bytes = 0;
        for (const r of contacts) {
          const built = buildFor(b.kind, b.draft, r);
          const slug = (r.name || r.email).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          writeFileSync(path.join(OUT, `${slug}.eml`), built.raw, 'utf8');
          bytes += Buffer.byteLength(built.raw);
        }
        note(`Wrote ${contacts.length} .eml file(s) to admin/out, `
          + `${(bytes / contacts.length / 1048576).toFixed(2)} MB each.`);
        return json(res, 200, state());
      }
      if (url.pathname === '/api/send') {
        const result = await doSend(b);
        return json(res, 200, { ...state(), result });
      }
    }

    res.writeHead(404); res.end('not found');
  } catch (e) {
    note(`ERROR: ${e.message}`);
    json(res, 500, { error: e.message, log: log.slice(-200) });
  }
});

const seeded = store.seedFromArc(HERE, ARC);
if (seeded) note(`Started your contact list from the ARC readers — ${seeded} imported, tagged "arc".`);

/**
 * Starting it twice is the easiest mistake there is to make: the panel is
 * still running in a terminal tab from this morning. Node's own answer to a
 * taken port is an unhandled 'error' event and a stack trace, which tells
 * someone who only wanted to write a letter nothing at all.
 */
server.on('error', (e) => {
  console.log('');
  if (e.code === 'EADDRINUSE') {
    console.log(`  Port ${PORT} is already in use.`);
    console.log('');
    console.log('  That is almost always the panel itself, still running in');
    console.log('  another terminal tab. Open it before starting a second:');
    console.log('');
    console.log(`      http://127.0.0.1:${PORT}`);
    console.log('');
    console.log('  If that page does not load, something else holds the port.');
    console.log('  Put the panel on a different one:');
    console.log('');
    console.log(`      ADMIN_PORT=${PORT + 1} npm run admin`);
  } else {
    console.log(`  The panel could not start: ${e.message}`);
  }
  console.log('');
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log(`  Admin  →  http://127.0.0.1:${PORT}`);
  console.log('  Local only. Nothing outside this Mac can reach it.');
  console.log('  Stop it with Ctrl-C.');
  console.log('');
});
