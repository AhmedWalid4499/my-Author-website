/**
 * A letter you wrote, set in the same hand as the rest of the site.
 *
 * You type plain text in the panel; this turns it into the HTML half of the
 * email and tidies the plain-text half. The point is that a note dashed off in
 * four lines still arrives looking like it came from an author rather than
 * from a form.
 *
 * Email HTML is not web HTML: tables for layout, inline styles only, no
 * flexbox, no grid, no <style> you can rely on, no web fonts. Pictures are
 * attached and referenced as cid:, never fetched — nobody gets a tracking
 * pixel from this.
 *
 * WHAT YOU CAN WRITE
 *   A blank line starts a new paragraph.
 *   # Heading             a line on its own
 *   > Something quoted    a line on its own, set in italic against the warm panel
 *   ---                   a divider
 *   *italic*  **bold**    inside a paragraph
 *   [words](https://…)    a link
 *   {{name}}              the reader's name
 *   {{first}}             their first name, or "there" if you only have an address
 *
 * Everything else is literal. Angle brackets and ampersands are escaped, so
 * nothing anyone types can break the markup or smuggle in HTML.
 */

/* Same palette as the ARC letter, so the two read as one correspondence. */
const C = {
  cobalt:     '#2b64a3',
  cobaltDeep: '#1e4a7d',
  cream:      '#fdf8f0',
  creamWarm:  '#f6ece0',
  page:       '#efe3d4',
  ink:        '#2c1f14',
  inkSoft:    '#5c4636',
  amber:      '#9a6428',
  line:       '#e3d4c0',
};

const SERIF = "Georgia, 'Times New Roman', Times, serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const firstName = (name) => (name || '').trim().split(/\s+/)[0] || 'there';

/** {{name}} and {{first}}, and nothing else — an unknown {{token}} is left alone. */
export function fill(body, reader) {
  return String(body || '')
    .replace(/\{\{\s*name\s*\}\}/gi, (reader.name || '').trim() || 'there')
    .replace(/\{\{\s*first\s*\}\}/gi, firstName(reader.name));
}

/* ------------------------------------------------------------ inline runs */

/**
 * Bold, italic and links, applied to text that is already escaped.
 *
 * Order matters: ** before *, or the first star of a bold pair opens an
 * italic run and the markup comes out inside-out.
 */
function inline(escaped) {
  return escaped
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      (_, label, href) =>
        `<a href="${href}" style="color:${C.cobalt};text-decoration:underline;">${label}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight:bold;">$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em style="font-style:italic;">$1</em>');
}

/* ------------------------------------------------------------------ html */

export function html(letter, reader, opts = {}) {
  const body = fill(letter.body, reader);
  const author = opts.author || 'Ahmed El-Bourgy';
  const place = opts.place || 'Cairo';
  const siteUrl = opts.siteUrl || '';

  const P = `margin:0 0 18px;font-family:${SERIF};font-size:16px;line-height:1.78;color:${C.inkSoft};`;

  const blocks = [];
  for (const raw of body.split(/\n{2,}/)) {
    const chunk = raw.trim();
    if (!chunk) continue;

    if (/^---+$/.test(chunk)) {
      blocks.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0;">
        <tr><td style="height:1px;background:${C.line};font-size:0;line-height:0;">&nbsp;</td></tr></table>`);
      continue;
    }

    if (chunk.startsWith('# ')) {
      blocks.push(`<p style="margin:30px 0 14px;font-family:${SERIF};font-size:23px;line-height:1.3;color:${C.ink};">`
        + inline(esc(chunk.slice(2).trim())) + '</p>');
      continue;
    }

    if (chunk.startsWith('> ')) {
      const quoted = chunk.split('\n').map((l) => l.replace(/^>\s?/, '')).join(' ').trim();
      blocks.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;background:${C.creamWarm};border-left:3px solid ${C.cobalt};">
        <tr><td style="padding:18px 22px;">
          <p style="margin:0;font-family:${SERIF};font-style:italic;font-size:16px;line-height:1.7;color:${C.ink};">`
        + inline(esc(quoted)) + '</p></td></tr></table>');
      continue;
    }

    // A single newline inside a paragraph is a line break the writer meant.
    blocks.push(`<p style="${P}">` + inline(esc(chunk)).replace(/\n/g, '<br>') + '</p>');
  }

  const hero = opts.heroCid ? `
      <tr><td style="padding:0;">
        <img src="cid:${opts.heroCid}" width="600" alt="${esc(opts.heroAlt || '')}"
             style="display:block;width:100%;max-width:600px;height:auto;border:0;">
      </td></tr>` : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(letter.subject || '')}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%;">

<!-- Shown in the inbox list under the subject, and nowhere else. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(letter.preheader || '')}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};">
<tr><td align="center" style="padding:30px 16px;">

  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${C.cream};border:1px solid ${C.line};">
    ${hero}
    <tr><td style="padding:38px 44px 10px;">
      <p style="margin:0 0 26px;font-family:${SANS};font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:${C.amber};">${esc(opts.eyebrow || author)}</p>
      ${blocks.join('\n      ')}
    </td></tr>

    <tr><td style="padding:16px 44px 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="width:60px;height:1px;background:${C.line};font-size:0;line-height:0;">&nbsp;</td></tr>
      </table>
      <p style="margin:20px 0 0;font-family:${SERIF};font-size:21px;color:${C.ink};">${esc(author)}</p>
      <p style="margin:2px 0 0;font-family:${SANS};font-size:12px;letter-spacing:1.6px;text-transform:uppercase;color:${C.amber};">${esc(place)}</p>
    </td></tr>
  </table>

  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
    <tr><td style="padding:18px 44px 0;font-family:${SANS};font-size:12px;line-height:1.7;color:#7b6450;">
      <p style="margin:0;">You are getting this because ${esc(author)} writes to you directly.
      Reply to this message and it comes straight back to him.</p>
      ${siteUrl ? `<p style="margin:8px 0 0;"><a href="${esc(siteUrl)}" style="color:${C.cobaltDeep};">${esc(siteUrl.replace(/^https?:\/\//, ''))}</a></p>` : ''}
    </td></tr>
  </table>

</td></tr>
</table>
</body>
</html>`;
}

/* ------------------------------------------------------------------ text */

/**
 * The plain-text half. Not a fallback nobody reads: it is what a screen reader
 * and a text-only client get, and spam filters distrust a message that has
 * only HTML.
 */
export function text(letter, reader, opts = {}) {
  const author = opts.author || 'Ahmed El-Bourgy';
  const place = opts.place || 'Cairo';
  const siteUrl = opts.siteUrl || '';

  const out = [];
  for (const raw of fill(letter.body, reader).split(/\n{2,}/)) {
    const chunk = raw.trim();
    if (!chunk) continue;
    if (/^---+$/.test(chunk)) { out.push('—'.repeat(30)); continue; }
    if (chunk.startsWith('# ')) {
      const h = chunk.slice(2).trim();
      out.push(h.toUpperCase());
      continue;
    }
    if (chunk.startsWith('> ')) {
      out.push(chunk.split('\n').map((l) => '  ' + l.replace(/^>\s?/, '')).join('\n'));
      continue;
    }
    // Links become "label (url)" — a bare URL in running text is unreadable.
    out.push(chunk
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1 ($2)')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1'));
  }

  out.push('', author, place.toUpperCase());
  out.push('', `You are getting this because ${author} writes to you directly.`,
    'Reply to this message and it comes straight back to him.');
  if (siteUrl) out.push(siteUrl);

  return out.join('\n\n').replace(/\n{3,}/g, '\n\n') + '\n';
}
