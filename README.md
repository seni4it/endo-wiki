# EndoWiki

A community knowledge base for endodontists — peer-contributed clinical articles plus honest, structured reviews of courses and equipment.

Built with [Docsify](https://docsify.js.org/) (no build step, pure markdown) and hosted for free on GitHub Pages. Non-technical contributors edit via [Decap CMS](https://decapcms.org/) — a visual editor in the browser that commits to git behind the scenes.

**👉 Live site:** *after first deploy, will be at* `https://YOUR-GITHUB-USERNAME.github.io/endo-wiki/`

---

## One-time setup (~15 min)

### 1. Create a GitHub repo

1. Sign in at [github.com](https://github.com). Create an account if you don't have one — it's free.
2. Click **New repository**. Name it `endo-wiki`. Public. Do **not** initialize with a README (we already have one).
3. Copy the URL of the new empty repo (e.g. `https://github.com/YOUR-USERNAME/endo-wiki.git`).

### 2. Push this project to the repo

From a Terminal on your Mac, in this folder:

```bash
cd ~/Documents/endo-wiki
git init
git add -A
git commit -m "Initial EndoWiki commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/endo-wiki.git
git push -u origin main
```

### 3. Enable GitHub Pages

1. On the GitHub repo page → **Settings** → **Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Go to the **Actions** tab. Watch the "Deploy to GitHub Pages" workflow finish (~1 minute).
4. When done, your site is live at `https://YOUR-USERNAME.github.io/endo-wiki/`.

### 4. Update repo references

Search-and-replace `YOUR-GITHUB-USERNAME` in these files, commit:

- `index.html` — enables "Edit on GitHub" + "History" + "Discuss" links
- `admin/config.yml` — the CMS site_url
- `contributing.md` and `editorial-guidelines.md` — issue tracker link

### 5. (Optional) Enable the visual editor for non-technical contributors

This lets people log in at `/admin/` and write articles in a Microsoft-Word-like editor, no git knowledge needed.

1. Sign up for a free [Netlify](https://app.netlify.com/signup) account (no card required).
2. **Add new site** → **Import an existing project** → connect GitHub → select `endo-wiki`. Netlify will deploy its own mirror (you can ignore the Netlify URL and keep using the GitHub Pages URL).
3. In Netlify: **Site settings** → **Identity** → **Enable Identity**.
4. Under **Identity** → **Registration**, set to **Invite only** (so random people can't sign up).
5. Under **Identity** → **Services**, scroll to **Git Gateway** → **Enable Git Gateway**.
6. Under **Identity**, click **Invite users** and invite yourself + co-editors (by email).

Accept the invite email → set a password → visit `https://YOUR-USERNAME.github.io/endo-wiki/admin/` → log in → edit visually.

### 6. (Optional) Point a custom domain

If you bought e.g. `wikiendo.com` on Namecheap:

1. At Namecheap → your domain → **Advanced DNS**. Add these records:
   - Type `A`, Host `@`, Value `185.199.108.153` (and `109`, `110`, `111` on four rows)
   - Type `CNAME`, Host `www`, Value `YOUR-USERNAME.github.io`
2. On GitHub repo → **Settings** → **Pages** → **Custom domain** → enter `wikiendo.com` → check "Enforce HTTPS" once it's available (may take ~10 min after DNS propagates).

---

## Project layout

```
endo-wiki/
├── index.html              Docsify loader (site shell)
├── home.md                 The wiki homepage (what visitors see at /)
├── README.md               This file — shown on GitHub, not on the wiki
├── LICENSE                 Content: CC BY-SA 4.0; code: MIT
├── _sidebar.md             Sidebar navigation (global)
├── _navbar.md              Top navbar (global)
├── _coverpage.md           Cover splash page
├── contributing.md         Contributor guide
├── editorial-guidelines.md Writing style and ethics rules
├── write-review.md         How to write a review (markdown template)
├── articles/               Clinical articles
│   ├── README.md           Articles index
│   └── *.md                Individual articles
├── reviews/
│   ├── README.md           Reviews landing
│   ├── courses/            Course reviews
│   └── equipment/          Equipment reviews
├── assets/
│   ├── styles.css          Custom theme
│   ├── reviews.js          Renders review cards from frontmatter/JSON
│   └── uploads/            User-uploaded images (via Decap CMS)
├── admin/                  Decap CMS (visual editor)
│   ├── index.html
│   └── config.yml
└── .github/workflows/
    └── pages.yml           Auto-deploy to GitHub Pages on push
```

## Local preview

You can preview changes before pushing. In the project folder:

```bash
# Python 3 (built into macOS after Xcode tools; otherwise install from python.org)
python3 -m http.server 8080
```

Open `http://localhost:8080` in your browser.

## License

- **Content** (articles, reviews): [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) — share and adapt, credit authors, inherit the license.
- **Code** (index.html, assets/*.js, assets/*.css, workflow files): MIT.

See [LICENSE](LICENSE).

## Disclaimer

Content on EndoWiki is for educational purposes only and does not constitute medical advice. Diagnostic and treatment decisions are the responsibility of the treating clinician.
