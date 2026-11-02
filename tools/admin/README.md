# The admin panel

Your own page for writing to your readers. It runs on your Mac, not on the
website.

```bash
cd tools && npm run admin
```

Then open **http://127.0.0.1:8899**.

If it says the port is already in use, the panel is already running in another
terminal tab — open the address above rather than starting a second one. It
keeps running until you close that tab or press Ctrl-C in it.

## Why it is not on the website

The site is static files on GitHub Pages. There is no server behind it, so it
cannot send mail, hold your contact list, or keep a password. And a send-mail
page on a public URL would let anyone who found it write to your readers as
you.

So the panel runs here instead. It binds to `127.0.0.1`, which means nothing
else on your network can reach it, and it is gone the moment you close the
terminal. Your Gmail app password is typed into the page, used for the length
of one send, and never written to disk.

## The four tabs

**Write** — pick what you are sending. *A letter* is anything you write
yourself; *the advance copy* is the themed letter with the EPUB attached, whose
words live in `../arc/template.mjs`. The right-hand side shows the letter as it
will arrive, addressed to the first person on your list so you can see the
greeting land.

**People** — your list. It lives in `contacts.csv` next to this file, so you
can open it in Numbers and edit it there instead if you would rather. Groups
are free text — `arc` on your advance readers, `press` on reviewers, whatever
you like, separated by semicolons. Nothing is collected from the website; this
list is only what you put in it.

**Send** — choose the groups, sign in, and work down the buttons. Each one is
harmless until the last.

**History** — what went out and to whom, so the panel can stop a letter
reaching someone twice.

## Writing a letter

A blank line starts a new paragraph. Beyond that:

| You type | You get |
|---|---|
| `{{first}}` | their first name, or "there" if you only have an address |
| `{{name}}` | their full name |
| `*italic*` | *italic* |
| `**bold**` | **bold** |
| `[words](https://…)` | a link |
| `# Heading` | a heading, on its own line |
| `> Quoted` | set in italic against the warm panel |
| `---` | a divider |

Everything else is literal. Angle brackets and ampersands are escaped, so
nothing can break the markup.

## Sending

Gmail needs an **app password**, not your normal one: Google Account →
Security → 2-Step Verification → App passwords.

Work down the buttons in order:

1. **Dry run** — lists exactly who would receive it. Sends nothing.
2. **Write .eml files** — a complete message per person in `admin/out/`. Open
   one to check the picture appears and the attachment is there. You can also
   drag these into Drafts in Apple Mail and send them from there instead.
3. **Send one to me** — the real thing, to your own address.
4. **Send to everyone selected** — asks you to confirm, then goes.

Each person gets their own message. Nobody is ever in a To: line with anyone
else — these are letters, not a mailing list, and a visible list of addresses
would be a leak.

There is a pause of just over a second between messages. Gmail stops a normal
account at around 500 a day and gets suspicious when they arrive all at once.

## What is kept here

| File | What it is |
|---|---|
| `contacts.csv` | your list |
| `drafts.json` | letters written but not sent |
| `history.json` | what went out, to whom, when |
| `out/` | built `.eml` files |

All four are git-ignored. Reader addresses, an unreleased manuscript and your
correspondence do not belong in a public repo. `contacts.example.csv` is the
only one committed, and it is made-up names.

## How a message is put together

`../mail.mjs` assembles every message and sends it — the advance copy and
anything you write. One builder, so what you preview, what lands in an `.eml`
and what actually leaves are the same bytes.

Pictures are attached and referenced as `cid:`, never fetched from a server.
Nobody gets a tracking pixel from this, and the letter looks right with images
turned off.

Every message carries both a plain-text and an HTML half. The plain half is
not a fallback nobody reads: it is what a screen reader gets, and a message
with only HTML is what spam filters distrust most.
