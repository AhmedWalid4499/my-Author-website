/**
 * The ARC email: copy and design, in one place.
 *
 * Edit freely. `build.mjs` handles MIME, attachments and per-reader output and
 * never needs touching when the words change.
 *
 * Email HTML is not web HTML: tables for layout, inline styles only, no flexbox,
 * no grid, no <style> you rely on, no web fonts. The hero is attached inline and
 * referenced as cid:hero so it renders with images-off clients disabled and loads
 * nothing from the network — nobody gets a tracking pixel from me.
 */

/* Palette sampled from the announcement artwork. */
const C = {
  cobalt:     '#2b64a3',   // the shopfront. 5.75:1 on cream — safe for text.
  cobaltDeep: '#1e4a7d',
  cream:      '#fdf8f0',
  creamWarm:  '#f6ece0',
  page:       '#efe3d4',   // the stone street
  ink:        '#2c1f14',
  inkSoft:    '#5c4636',   // 7.4:1 on cream
  amber:      '#9a6428',   // lamplight, darkened to 4.9:1 for text
  blossom:    '#e8b4bd',
  line:       '#e3d4c0',
};

const SERIF = "Georgia, 'Times New Roman', Times, serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
// Same stack; font-style does the work. Named separately so italic runs are
// obvious at the call site.
const SERIF_I = SERIF;

const firstName = (name) => (name || '').trim().split(/\s+/)[0] || 'there';

export function subject(c) {
  return c.subject || `Your advance copy of ${c.titlePlain}`;
}

/* ------------------------------------------------------------------ plain text */
export function text(c, reader) {
  const when = c.releaseDate
    ? ` The shop opens properly on ${c.releaseDate}; you are getting in early.`
    : ' The shop opens properly soon; you are getting in early.';
  const by = c.reviewBy
    ? `around release day — ideally by ${c.reviewBy}`
    : 'around release day';

  return `Dear ${firstName(reader.name)},

Attached to this email is the full advance copy of ${c.titlePlain}, as an EPUB.
It is yours to read however you like.${when}

Here is what it is.

  The cat finds you first.

  Grey and white, one blue eye and one green, and absolutely no patience. He
  meows once, like an order, and walks away. You follow, because something in
  you already knows you should.

  He leads you to Aoi Shiori, a little bookshop that wasn't there yesterday
  and won't be there tomorrow. The light inside is warm. Its owner, Mirai,
  smiles as if she has been waiting for you all day. And from a sky without a
  single cloud, it begins to rain.

  Everyone who finds this place has lost something along the way. A dream. A
  goodbye. A piece of themselves. Mirai never asks which. She pours you
  something warm, and before you go, she asks you to take an umbrella from the
  box by the door.

  Step beneath it, and the rain falls silent.

WHAT I WOULD LOVE, IF THE BOOK EARNS IT
An honest review ${by}, wherever you normally leave them: Amazon, Goodreads, a
post, a message to one friend who would like it. Honest is the important word.
If the book does not work for you, I would genuinely rather know. And if life
gets in the way and you never finish it, that is completely fine — no reply
needed and no awkwardness, now or later.

OPENING THE EPUB
  Kindle   - forward this email to your Send-to-Kindle address, or open the file
             in the Kindle app
  iPhone   - tap the attachment and choose Books
  Android  - open it with Google Play Books
  Computer - Calibre, Apple Books, or any EPUB reader

MAKING SURE THIS IS REALLY FROM ME
${c.verifyUrl}
That page is on my own website and lists the ARC campaign I am actually running.
If an email about my books ever reaches you and that page does not mention it,
it did not come from me.

Please return the umbrella. Someone else might need their day.

Thank you for reading something before anybody has told you what to think of it.
That is a rarer kindness than it sounds.

Warmly,
Ahmed El-Bourgy
Cairo

${c.siteUrl}
You are getting this because you said yes to an advance copy. If that was a
while ago and you would rather not, just reply with "no thanks" and I will take
you off the list — no explanation needed.`;
}

/* ------------------------------------------------------------------ html */
export function html(c, reader) {
  const when = c.releaseDate
    ? `The shop opens properly on <strong style="color:${C.ink};">${esc(c.releaseDate)}</strong>, so you are getting in early.`
    : 'The shop opens properly soon, so you are getting in early.';
  const by = c.reviewBy
    ? `around release day &mdash; ideally by <strong>${esc(c.reviewBy)}</strong>`
    : 'around release day';

  const p = `margin:0 0 18px;font-family:${SERIF};font-size:16px;line-height:1.75;color:${C.inkSoft};`;
  const label = `margin:0;font-family:${SANS};font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:${C.amber};`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(subject(c))}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%;">

<div style="display:none;max-height:0;overflow:hidden;opacity:0;">
Your advance copy of ${esc(c.titlePlain)} is attached, as an EPUB.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};">
<tr><td align="center" style="padding:28px 12px 40px;">

  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${C.cream};border:1px solid ${C.line};">

    <!-- hero -->
    <tr><td style="font-size:0;line-height:0;">
      <img src="cid:hero" width="600" alt="${esc(c.heroAlt)}"
           style="display:block;width:100%;max-width:600px;height:auto;border:0;">
    </td></tr>

    <!-- title -->
    <tr><td style="padding:34px 40px 0;" align="center">
      <p style="${label}">Advance reader copy</p>
      <h1 style="margin:14px 0 4px;font-family:${SERIF};font-size:31px;line-height:1.2;font-weight:normal;color:${C.ink};">
        The Blue Bookmark <em style="color:${C.cobalt};">Bookshop</em>
      </h1>
      <p style="margin:0;font-family:${SERIF};font-size:15px;color:${C.inkSoft};letter-spacing:3px;">${esc(c.titleJp)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px auto 0;">
        <tr><td style="width:60px;height:1px;background:${C.line};font-size:0;line-height:0;">&nbsp;</td></tr>
      </table>
    </td></tr>

    <!-- letter -->
    <tr><td style="padding:28px 40px 0;">
      <p style="${p}">Dear ${esc(firstName(reader.name))},</p>
      <p style="${p}">Your advance copy of <em>${esc(c.titlePlain)}</em> is attached to this email, as an EPUB. ${when}</p>
    </td></tr>

    <!-- the book's own words, set apart from the letter -->
    <tr><td style="padding:6px 40px 0;">
      <p style="${label}">About the book</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;background:${C.creamWarm};">
        <tr><td style="padding:22px 24px;">
          <p style="margin:0 0 15px;font-family:${SERIF_I};font-style:italic;font-size:17px;line-height:1.7;color:${C.ink};">The cat finds you first.</p>
          <p style="margin:0 0 15px;font-family:${SERIF};font-size:15px;line-height:1.78;color:${C.inkSoft};">Grey and white, one blue eye and one green, and absolutely no patience. He meows once, like an order, and walks away. You follow, because something in you already knows you should.</p>
          <p style="margin:0 0 15px;font-family:${SERIF};font-size:15px;line-height:1.78;color:${C.inkSoft};">He leads you to Aoi Shiori, a little bookshop that wasn&rsquo;t there yesterday and won&rsquo;t be there tomorrow. The light inside is warm. Its owner, Mirai, smiles as if she has been waiting for you all day. And from a sky without a single cloud, it begins to rain.</p>
          <p style="margin:0 0 15px;font-family:${SERIF};font-size:15px;line-height:1.78;color:${C.inkSoft};">Everyone who finds this place has lost something along the way. A dream. A goodbye. A piece of themselves. Mirai never asks which. She pours you something warm, and before you go, she asks you to take an umbrella from the box by the door.</p>
          <p style="margin:0;font-family:${SERIF_I};font-style:italic;font-size:16px;line-height:1.7;color:${C.cobaltDeep};">Step beneath it, and the rain falls silent.</p>
        </td></tr>
      </table>
    </td></tr>

    <!-- attachment -->
    <tr><td style="padding:10px 40px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.creamWarm};border-left:3px solid ${C.cobalt};">
        <tr><td style="padding:20px 22px;">
          <p style="${label}">Attached to this email</p>
          <p style="margin:9px 0 0;font-family:${SERIF};font-size:16px;line-height:1.6;color:${C.ink};">
            The complete book, unedited by anyone else&rsquo;s opinion of it.
          </p>
          <p style="margin:6px 0 0;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.inkSoft};">
            EPUB &middot; opens on Kindle, phone, tablet or computer.
          </p>
        </td></tr>
      </table>
    </td></tr>

    <!-- the ask -->
    <tr><td style="padding:26px 40px 0;">
      <p style="${label}">What I would love, if the book earns it</p>
      <p style="${p}margin-top:12px;">An honest review ${by}, wherever you normally leave them &mdash; Amazon, Goodreads, a post, a message to one friend who would like it.</p>
      <p style="${p}"><em>Honest</em> is the important word there. If the book does not work for you, I would genuinely rather know. And if life gets in the way and you never finish it, that is completely fine &mdash; no reply needed and no awkwardness, now or later.</p>
    </td></tr>

    <!-- how to open -->
    <tr><td style="padding:8px 40px 0;">
      <p style="${label}">Opening the EPUB</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;font-family:${SANS};font-size:13.5px;line-height:1.65;color:${C.inkSoft};">
        ${[
          ['Kindle', 'forward this email to your Send-to-Kindle address, or open the file in the Kindle app'],
          ['iPhone', 'tap the attachment and choose Books'],
          ['Android', 'open it with Google Play Books'],
          ['Computer', 'Calibre, Apple Books, or any EPUB reader'],
        ].map(([k, v]) => `<tr>
          <td valign="top" style="padding:0 14px 7px 0;white-space:nowrap;color:${C.cobaltDeep};font-weight:bold;">${k}</td>
          <td valign="top" style="padding:0 0 7px;">${v}</td>
        </tr>`).join('')}
      </table>
    </td></tr>

    <!-- authenticity -->
    <tr><td style="padding:26px 40px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.line};">
        <tr><td style="padding:18px 22px;">
          <p style="${label}">Making sure this is really from me</p>
          <p style="margin:9px 0 0;font-family:${SANS};font-size:13.5px;line-height:1.7;color:${C.inkSoft};">
            <a href="${esc(c.verifyUrl)}" style="color:${C.cobaltDeep};">${esc(c.verifyUrl.replace(/^https?:\/\//, ''))}</a><br>
            That page is on my own website and lists the ARC campaign I am actually
            running. If an email about my books ever reaches you and that page does
            not mention it, it did not come from me.
          </p>
        </td></tr>
      </table>
    </td></tr>

    <!-- closing -->
    <tr><td style="padding:28px 40px 0;">
      <p style="margin:0 0 10px;font-family:${SERIF};font-size:15px;line-height:1.9;color:${C.cobaltDeep};text-align:center;">ご使用後はお返しください。<br>誰かの一日に必要かもしれません。</p>
      <p style="margin:0 0 20px;font-family:${SERIF_I};font-style:italic;font-size:16px;line-height:1.8;color:${C.inkSoft};text-align:center;">Please return the umbrella.<br>Someone else might need their day.</p>
      <p style="${p}">Thank you for reading something before anybody has told you what to think of it. That is a rarer kindness than it sounds.</p>
      <p style="${p}margin-bottom:4px;">Warmly,</p>
      <p style="margin:0;font-family:${SERIF};font-size:21px;color:${C.ink};">Ahmed El-Bourgy</p>
      <p style="margin:2px 0 0;font-family:${SANS};font-size:12px;letter-spacing:1.6px;text-transform:uppercase;color:${C.amber};">Cairo</p>
    </td></tr>

    <tr><td style="padding:30px 40px 34px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="height:1px;background:${C.line};font-size:0;line-height:0;">&nbsp;</td></tr>
      </table>
      <p style="margin:18px 0 0;font-family:${SANS};font-size:11.5px;line-height:1.8;color:#7d6250;">
        <a href="${esc(c.siteUrl)}" style="color:#7d6250;">${esc(c.siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</a> &middot;
        <a href="${esc(c.goodreads)}" style="color:#7d6250;">Goodreads</a><br>
        You are getting this because you said yes to an advance copy. If that was a
        while ago and you would rather not, reply with &ldquo;no thanks&rdquo; and I
        will take you off the list &mdash; no explanation needed.
      </p>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
