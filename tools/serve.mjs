import http from 'http';
import { readFile, stat } from 'fs/promises';

import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PORT = 8765;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

http.createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(ROOT, url);
  if (url.endsWith('/')) file = path.join(file, 'index.html');

  // Keep traversal inside the project root.
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }

  try {
    const info = await stat(file);
    if (info.isDirectory()) file = path.join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store, must-revalidate',
    });
    res.end(body);
  } catch {
    console.warn('404 →', url, '(referer:', req.headers.referer || 'none', ')');
    // Mirror GitHub Pages: unknown paths render 404.html.
    try {
      const body = await readFile(path.join(ROOT, '404.html'));
      res.writeHead(404, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404 ' + url);
    }
  }
}).listen(PORT, '127.0.0.1', () => console.log('dev server on http://127.0.0.1:' + PORT));
