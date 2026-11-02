/**
 * The one place a message is assembled, and the one place it is sent.
 *
 * Both the advance-copy letter and anything written in the admin panel end up
 * here, so what you preview, what lands in an .eml file and what actually
 * leaves your machine are the same bytes built by the same code.
 *
 * Nothing in this file knows about any particular letter. It takes a subject,
 * two bodies, some pictures and some files, and returns RFC 822.
 */
import { randomBytes } from 'crypto';
import nodemailer from 'nodemailer';

const CRLF = '\r\n';

/* --------------------------------------------------------------- headers */

/** Addresses are ASCII; display names are not. Only the name gets encoded. */
const needsEncoding = (s) => /[^\x20-\x7E]/.test(s);

export const encodeHeader = (s) =>
  needsEncoding(s) ? `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=` : s;

export const address = (name, email) =>
  name ? `${encodeHeader(name)} <${email}>` : email;

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/* ------------------------------------------------------------------ mime */

const b64 = (buf) => (buf.toString('base64').match(/.{1,76}/g) || []).join(CRLF);
const boundary = (tag) => `----=_${tag}_${randomBytes(12).toString('hex')}`;

/**
 * One complete message.
 *
 *   multipart/mixed                     (only when there are attachments)
 *   └── multipart/related               (only when there are inline images)
 *       └── multipart/alternative
 *           ├── text/plain
 *           └── text/html
 *
 * The wrappers are only added when they carry something. A plain letter with
 * no picture and no attachment comes out as a bare multipart/alternative,
 * which is what a mail client expects and what spam filters are least
 * suspicious of.
 *
 * @param {object}   m
 * @param {object}   m.from        {name, email}
 * @param {object}   m.to          {name, email}
 * @param {string}  [m.replyTo]
 * @param {string}   m.subject
 * @param {string}   m.text        the plain-text body
 * @param {string}   m.html        the HTML body
 * @param {Array}   [m.inline]     [{cid, filename, mime, buf}] — referenced
 *                                 from the HTML as src="cid:<cid>"
 * @param {Array}   [m.attachments][{filename, mime, buf}]
 * @param {Date}    [m.date]       overridable so a test can be deterministic
 */
export function composeMessage(m) {
  const inline = m.inline || [];
  const attachments = m.attachments || [];
  const domain = m.from.email.split('@')[1] || 'localhost';
  const when = m.date || new Date();

  const ALT = boundary('alt');
  let body = [];
  body.push(`--${ALT}`, 'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64', '', b64(Buffer.from(m.text, 'utf8')));
  body.push(`--${ALT}`, 'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64', '', b64(Buffer.from(m.html, 'utf8')));
  body.push(`--${ALT}--`, '');
  let contentType = `multipart/alternative; boundary="${ALT}"`;

  if (inline.length) {
    const REL = boundary('rel');
    const wrapped = [`--${REL}`, `Content-Type: ${contentType}`, '', ...body];
    for (const img of inline) {
      wrapped.push(`--${REL}`, `Content-Type: ${img.mime}; name="${img.filename}"`,
        'Content-Transfer-Encoding: base64', `Content-ID: <${img.cid}>`,
        `Content-Disposition: inline; filename="${img.filename}"`, '', b64(img.buf));
    }
    wrapped.push(`--${REL}--`, '');
    body = wrapped;
    contentType = `multipart/related; boundary="${REL}"`;
  }

  if (attachments.length) {
    const MIX = boundary('mix');
    const wrapped = [`--${MIX}`, `Content-Type: ${contentType}`, '', ...body];
    for (const file of attachments) {
      wrapped.push(`--${MIX}`, `Content-Type: ${file.mime}; name="${file.filename}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${file.filename}"`, '', b64(file.buf));
    }
    wrapped.push(`--${MIX}--`, '');
    body = wrapped;
    contentType = `multipart/mixed; boundary="${MIX}"`;
  }

  const head = [
    `From: ${address(m.from.name, m.from.email)}`,
    `To: ${address(m.to.name, m.to.email)}`,
    m.replyTo ? `Reply-To: ${m.replyTo}` : null,
    `Subject: ${encodeHeader(m.subject)}`,
    `Date: ${when.toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${when.getTime()}.${randomBytes(8).toString('hex')}@${domain}>`,
    'MIME-Version: 1.0',
    `Content-Type: ${contentType}`,
  ].filter(Boolean).join(CRLF);

  return head + CRLF + CRLF + body.join(CRLF);
}

/* ------------------------------------------------------------------ send */

/**
 * Gmail over SMTP, one message per recipient.
 *
 * One message each rather than a single message with everyone in it: a reader
 * should never see the other readers' addresses, and nothing here is a mailing
 * list with an unsubscribe link, so a visible To: line would be a leak.
 *
 * Gmail will not let a normal account send more than about 500 messages in a
 * day and gets suspicious when they arrive all at once, so there is a pause
 * between them. `onProgress` is called after each so the panel can show where
 * it is rather than freezing.
 */
export async function sendAll({ user, pass, messages, pauseMs = 1200, onProgress }) {
  const tx = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass },
  });
  await tx.verify();

  let sent = 0;
  const failures = [];
  for (const { to, raw, envelopeFrom } of messages) {
    try {
      await tx.sendMail({ envelope: { from: envelopeFrom, to: to.email }, raw });
      sent++;
      if (onProgress) onProgress({ ok: true, to, sent, total: messages.length });
    } catch (err) {
      failures.push({ to, error: err.message });
      if (onProgress) onProgress({ ok: false, to, error: err.message, sent, total: messages.length });
    }
    if (pauseMs && sent + failures.length < messages.length) {
      await new Promise((r) => setTimeout(r, pauseMs));
    }
  }
  tx.close();
  return { sent, failures };
}

/** Check the password without sending anything. */
export async function verifyLogin({ user, pass }) {
  const tx = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass },
  });
  await tx.verify();
  tx.close();
  return true;
}
