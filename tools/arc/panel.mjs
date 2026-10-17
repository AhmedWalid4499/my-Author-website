/**
 * The ARC panel — a local admin page for writing and sending advance-copy mail.
 *
 *   cd tools && npm run arc
 *
 * Then open http://127.0.0.1:8787 in a browser.
 *
 * WHY THIS IS NOT ON THE WEBSITE
 * The site is static files on GitHub Pages. There is no server behind it, so
 * it cannot send mail, read your reader list, or hold a password. And a
 * send-mail panel on a public URL would let anyone who found it send mail as
 * you. So the panel runs on your own machine instead: it binds to 127.0.0.1
 * only, nothing outside this Mac can reach it, and it is gone when you close
 * the terminal.
 *
 * Your Gmail app password is typed into the page, held in memory for the
 * length of one send, and never written to disk or into the repo.
 */
import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import * as template from './template.mjs';
import { buildMessage, readCampaign, readReaders, writeReaders, writeCampaign, loadAssets } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.ARC_PORT || 8787);

// Any page in your browser can reach 127.0.0.1. This token, printed only in
// your terminal, is what stops one of them from quietly firing off a send.
const TOKEN = randomBytes(16).toString('hex');

const log = [];
const note = (m) => { log.push(`${new Date().toISOString().slice(11, 19)}  ${m}`); console.log('  ' + m); };

/* ------------------------------------------------------------------ api */
function state() {
  const c = readCampaign(HERE);
  let epub = null;
  if (c.epub && c.epub.trim()) {
    const abs = path.resolve(HERE, c.epub);
    epub = existsSync(abs)
      ? { ok: true, path: abs, mb: +(statSync(abs).size / 1048576).toFixed(2) }
      : { ok: false, path: abs };
  }
  const outDir = path.join(HERE, 'out');
  const built = existsSync(outDir) ? readdirSync(outDir).filter((f) => f.endsWith('.eml')) : [];
  return { campaign: c, readers: readReaders(HERE), epub, built, log: log.slice(-200) };
}

async function send({ user, pass, only, dryRun }) {
  const c = readCampaign(HERE);
  const readers = only ? [{ name: 'Test', email: only }] : readReaders(HERE);
  if (!readers.length) throw new Error('No readers to send to.');

  const assets = loadAssets(HERE, c);
  if (!assets.epub) note('WARNING: no EPUB attached — sending the letter alone.');

  if (dryRun) {
    note(`Dry run: ${readers.length} message(s) would go out as ${user}.`);
    for (const r of readers) note(`  would send to ${r.email}`);
    return { sent: 0, dryRun: true, count: readers.length };
  }

  const tx = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass },
  });
  await tx.verify();
  note(`Signed in to Gmail as ${user}.`);

  let sent = 0;
  for (const r of readers) {
    // The exact bytes the preview and the .eml files are built from, so what
    // you checked is what leaves.
    const raw = buildMessage(c, r, assets);
    await tx.sendMail({ envelope: { from: c.from.email, to: r.email }, raw });
    sent++;
    note(`sent ${sent}/${readers.length} → ${r.email}`);
  }
  tx.close();
  return { sent, dryRun: false, count: readers.length };
}

/* ------------------------------------------------------------------ ui */
const PAGE = () => readFileSync(path.join(HERE, 'panel.html'), 'utf8')
  .replace('__TOKEN__', TOKEN);

const json = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};

function body(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', (d) => { b += d; if (b.length > 4e6) req.destroy(); });
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

    if (req.method === 'GET' && url.pathname === '/api/preview') {
      const c = readCampaign(HERE);
      const readers = readReaders(HERE);
      const who = readers[0] || { name: 'Mina Tanaka', email: 'reader@example.com' };
      const assets = loadAssets(HERE, c);
      const html = template.html(c, who).replace('src="cid:hero"',
        `src="data:${assets.heroMime};base64,${assets.hero.toString('base64')}"`);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(html);
    }

    if (req.method === 'GET' && url.pathname === '/api/preview-text') {
      const c = readCampaign(HERE);
      const who = readReaders(HERE)[0] || { name: 'Mina Tanaka', email: 'reader@example.com' };
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end(template.text(c, who));
    }

    if (req.method === 'POST') {
      const b = await body(req);
      if (b.token !== TOKEN) return json(res, 403, { error: 'Bad token. Reload the page.' });

      if (url.pathname === '/api/campaign') {
        writeCampaign(HERE, b.campaign);
        note('Campaign saved.');
        return json(res, 200, state());
      }
      if (url.pathname === '/api/readers') {
        const n = writeReaders(HERE, b.readers);
        note(`Reader list saved — ${n} reader(s).`);
        return json(res, 200, state());
      }
      if (url.pathname === '/api/build') {
        const c = readCampaign(HERE);
        const readers = readReaders(HERE);
        const assets = loadAssets(HERE, c);
        const out = path.join(HERE, 'out');
        mkdirSync(out, { recursive: true });
        let bytes = 0;
        for (const r of readers) {
          const raw = buildMessage(c, r, assets);
          const slug = (r.name || r.email).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          writeFileSync(path.join(out, `${slug}.eml`), raw, 'utf8');
          bytes += Buffer.byteLength(raw);
        }
        note(`Built ${readers.length} .eml file(s), ${(bytes / readers.length / 1048576).toFixed(2)} MB each.`);
        return json(res, 200, state());
      }
      if (url.pathname === '/api/send') {
        const r = await send(b);
        return json(res, 200, { ...state(), result: r });
      }
    }
    res.writeHead(404); res.end('not found');
  } catch (e) {
    note(`ERROR: ${e.message}`);
    json(res, 500, { error: e.message, log: log.slice(-200) });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  ARC panel  →  http://127.0.0.1:8787');
  console.log('  Local only. Nothing outside this Mac can reach it.');
  console.log('  Stop it with Ctrl-C.');
  console.log('');
});
