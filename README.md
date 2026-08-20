# ΛΦΕ Alpha Xi — Chapter Website

The website for the **Alpha Xi Chapter** of Lambda Phi Epsilon International Fraternity at the
**University of Toronto** — chartered 5 December 2004 as the fraternity's first chapter outside
the United States.

Plain static HTML, CSS and JavaScript. **No build step, no framework, no npm install.**
Edit a file, save, refresh. Anyone on the exec board can maintain it.

---

## Quick start

Open `index.html` in a browser. That's it — the site works from the filesystem.

To run it on a local server instead (recommended, closer to production):

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

---

## Publishing to GitHub Pages

```bash
gh repo create toronto-lambdas --public --source=. --remote=origin --push
```

Then in the repository: **Settings → Pages → Source: _GitHub Actions_**.

`.github/workflows/deploy.yml` handles the rest. Every push to `main` redeploys automatically.
The site lands at `https://<username>.github.io/toronto-lambdas/`.

### Custom domain — yyzlambdas.com

The `CNAME` file at the repo root is already set to `yyzlambdas.com`. To finish hookup:

1. **At your DNS registrar**, create these records:

   | Type | Name | Value |
   |---|---|---|
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | CNAME | `www` | `<username>.github.io` |

2. **Settings → Pages → Custom domain** → enter `yyzlambdas.com` → Save
3. Wait for the DNS check to pass (minutes to a few hours), then tick **Enforce HTTPS**

Canonical URLs, Open Graph tags, `robots.txt` and `sitemap.xml` are already pointed at
`https://yyzlambdas.com`.

---

## Where the content lives

**You should almost never need to touch the HTML.** Nearly everything is driven by four data files:

| File | What it controls |
|---|---|
| `data/chapter.js` | Chapter email, Instagram, rush form link, stats. **Start here.** |
| `data/roster.js` | Exec board, active brothers, charter class, family lines |
| `data/alumni.js` | Alumni spotlights and sectors |
| `data/content.js` | Rush schedule, FAQ, traditions, gallery, reveal videos |

Anything marked `TODO` in those files renders on the page as a visible pink **placeholder tag**, so
it is obvious what still needs filling in. Search the repo for `TODO` to find every one:

```bash
grep -rn "TODO" data/
```

### Adding a brother

Open `data/roster.js` and add a line to `window.LPHIE.actives`:

```js
{ name: "Jane Doe", nick: "Nickname", class: "Class Name",
  crossed: "F26", program: "Engineering Science", family: "The Firm",
  photo: "jane-doe.jpg" }
```

Photos go in `assets/img/brothers/`. Leave `photo: ""` and the card shows the brother's initials
on a navy tile instead — the grid stays tidy either way.

### Adding gallery photos

Drop images into `assets/img/gallery/`, then list them in `data/content.js`:

```js
{ src: "retreat-2026.jpg", caption: "Fall retreat, Blue Mountain" }
```

---

## Assets you still need to add

The crest currently rendering on the site is a **vector approximation** built for this repo. To use
the official artwork, drop the real files in and the site picks them up automatically:

| Path | What to put there |
|---|---|
| `assets/img/crest.png` | Official crest (transparent PNG, ≥512px square) |
| `assets/img/flag.png` | Official chapter flag image |
| `assets/img/brothers/` | Brother headshots — portrait crop, ~600×800px |
| `assets/img/gallery/` | Event photos — landscape, ~1200px wide |

If you add `crest.png`, change the `src` in `assets/js/main.js` (search for `crest.svg`) — or simply
overwrite `assets/img/crest.svg` with the official vector if you have it.

**Compress photos before committing.** Aim for under 300KB each; `squoosh.app` does this in a browser.

---

## Pages

| File | Purpose |
|---|---|
| `index.html` | Home — identity, four pillars, values, philanthropy teaser |
| `about.html` | National + chapter history, founding fathers, charter class, symbols |
| `brothers.html` | Exec board, searchable active roster, family lines |
| `brotherhood.html` | Culture, traditions, campus and interchapter life |
| `rush.html` | Recruitment — schedule, process, FAQ |
| `philanthropy.html` | NMDP / stem cell registry, the Evan Chen story |
| `alumni.html` | Alumni spotlights, sectors, academics, career network |
| `media.html` | Gallery, class reveal archive, Instagram |
| `contact.html` | Contact form, direct channels, conduct reporting |
| `404.html` | Not-found page |

Navigation and footer are generated in `assets/js/main.js` — edit the `NAV` array there to add or
reorder pages, and it updates everywhere at once.

---

## Making the contact form send real email

The form currently opens the visitor's email client with the message pre-filled. That works
everywhere but is not ideal. To get submissions in an inbox instead, use a free static-form service:

1. Sign up at [Formspree](https://formspree.io/) (or Getform, Basin — all similar)
2. In `contact.html`, add `action="https://formspree.io/f/YOUR_ID" method="POST"` to the `<form>` tag
3. In `assets/js/main.js`, delete the `wireForm()` call inside `init()`

---

## Design system

Defined as CSS custom properties at the top of `assets/css/style.css`.

- **Royal blue and white only.** `--navy-700: #12296B` is the primary, sampled from the chapter crest.
  There is deliberately no third brand hue — accents are lighter blues (`--accent`), which flip
  automatically to a paler tone inside `.section--navy`.
- **Type:** Cormorant Garamond (display, full Greek coverage) + Inter (body).
- Reusable components: `.card`, `.btn`, `.timeline`, `.steps`, `.stats`, `.faq`, `.brother`,
  `.callout`, `.gallery`, `.eyebrow`, `.section--navy`, `.cta-band`.

---

## Accessibility & compatibility

- Skip-to-content link, semantic landmarks, `aria-current` on the active nav item
- Keyboard-navigable menu and accordions; visible focus rings throughout
- Honours `prefers-reduced-motion`
- Responsive from 320px up; nav collapses below 900px
- No build tooling, no external JS dependencies, no browser storage

---

## Licence & trademark

Site code: free for the chapter to use and modify.

The Lambda Phi Epsilon name, letters, crest and insignia are trademarks of **Lambda Phi Epsilon
International Fraternity, Inc.** Use of the marks is subject to fraternity policy — check with
Nationals before using them commercially or on merchandise.
