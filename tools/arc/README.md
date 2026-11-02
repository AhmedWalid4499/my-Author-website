# ARC mailer

Writes and sends the advance-copy email: themed to the book, EPUB attached.

## The panel moved

Writing and sending now happens in the admin panel, which handles this letter
and any other:

```bash
cd tools && npm run admin
```

See `../admin/README.md`. What stays here is the letter itself — its words and
its design, in `template.mjs` — and the command-line build below.

## Or from the command line

```bash
node arc/build.mjs --preview     # just look at the email
node arc/build.mjs --one         # first reader only
node arc/build.mjs               # every reader in arc/readers.csv
```

## Setup

1. `cp arc/readers.example.csv arc/readers.csv` and fill in `name,email`.
2. Put the EPUB somewhere and set `epub` in `arc/campaign.json` to its path.
3. Fill in `releaseDate` and `reviewBy`. Without them the email says "soon" and
   names no deadline — it still builds, it just reads vaguer.
4. Run the build. Output lands in `arc/out/`.

`readers.csv`, `arc/out/` and any `.epub` are git-ignored. Reader addresses and
an unreleased manuscript should not end up in a public repo.

## The .eml files

Each is a complete message. If you would rather not use the panel's send, open
one and send it from your own mail client — drag it into Drafts in Apple Mail
or Thunderbird, or any client that opens `.eml`.

Either way, send one to yourself first. Check that the picture appears, the
EPUB opens, and nothing in the letter is still a placeholder.

**Size.** A 5.3 MB EPUB becomes about 7.6 MB once base64-encoded into the
message. Gmail's ceiling is 25 MB, so that is fine, but some recipients'
servers are stricter — the panel warns above 20 MB.

## About "proof that this is really me"

Be clear with yourself about what proves what.

A beautiful email proves nothing. Anyone can copy a design, and the "From" line
on an email is as easy to type as any other. What actually proves authorship is:

**1. Your account's DKIM signature.** When a message leaves your real Gmail,
Google signs it cryptographically. The receiving server checks that signature
and shows a warning if it fails. This is the real proof, and it is why these are
`.eml` files you send yourself rather than something a script sends on your
behalf from somewhere else.

**2. A page on your own website.** The email points readers at `/arc.html`,
which lists the campaign actually running. A reader who wants to check can go
to your site — which they reached independently — and see whether the email
matches. Keep that page current: it is worth nothing if it is stale.

Those two together are genuinely strong. Neither needs your readers to
understand any of it.

What would *not* help: a logo, a "verified" badge, or a signature image. Those
are decoration, and a convincing forgery would copy them first.

If you ever move to a custom domain, set up SPF, DKIM and DMARC on it. Until
then, sending from Gmail is the stronger option precisely because Gmail's
signing is already correct.

## Editing the email

All copy and design is in `arc/template.mjs` — `subject()`, `html()`, `text()`.

`lib.mjs` holds the MIME builder and the campaign/reader IO. Both `build.mjs`
and the panel go through it, so the message you preview, the `.eml` you inspect
and the mail that actually leaves are assembled by the same code from the same
bytes.

Keep the plain-text version in step with the HTML. Some readers only ever see
that one, and a message with no text alternative scores worse with spam filters.
