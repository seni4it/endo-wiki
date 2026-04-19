# 🚀 Setup in 15 minutes

This is the **short version**. If you want the full explanation, see [README.md](README.md).

---

## What you need

- A Mac (you have this)
- A free **GitHub** account → sign up at [github.com/signup](https://github.com/signup) if you don't have one
- *(Optional, for the visual editor later)* A free **Netlify** account

That's all. No credit card. No domain needed yet.

---

## Step 1 — Create the GitHub repository

1. Go to [github.com/new](https://github.com/new)
2. **Repository name:** `endo-wiki`
3. **Public** (so GitHub Pages works on the free plan)
4. ⚠️ **Do NOT check "Add a README file"** — we already have one
5. Click **Create repository**
6. On the next page, copy the web URL (shown at the top — it looks like `https://github.com/YOUR-USERNAME/endo-wiki`). Keep it handy for Step 2.

## Step 2 — Push this project to GitHub

Open **Terminal** on your Mac. Copy-paste these commands one section at a time. Replace `YOUR-USERNAME` with your actual GitHub username.

```bash
cd ~/Documents/endo-wiki
```

```bash
git init
git add -A
git commit -m "Initial EndoWiki commit"
git branch -M main
```

```bash
git remote add origin https://github.com/YOUR-USERNAME/endo-wiki.git
git push -u origin main
```

The first push will ask you to authenticate. Easiest way:

1. Install [GitHub CLI](https://cli.github.com/): `brew install gh` — *or* on first push, Git on macOS usually pops up a browser window to log in via GitHub itself. Either works.

If it says "Authentication required", follow the prompts. You only do this once.

## Step 3 — Enable GitHub Pages

1. Go to `https://github.com/YOUR-USERNAME/endo-wiki/settings/pages`
2. Under **Build and deployment** → **Source** → pick **GitHub Actions**
3. Go to the **Actions** tab on the repo → wait for "Deploy to GitHub Pages" to show a green ✅ (takes ~1 minute)
4. Your wiki is live at `https://YOUR-USERNAME.github.io/endo-wiki/`

**Open that URL in your browser. Congratulations — you have a live wiki on the internet.** 🎉

## Step 4 — Connect the repo name inside the wiki

So the "Edit on GitHub" links work:

1. In **Terminal**, replace `seni4it` with your actual GitHub username. Run:

```bash
cd ~/Documents/endo-wiki
sed -i '' 's/seni4it/YOUR-USERNAME/g' index.html admin/config.yml contributing.md README.md SETUP.md
git add -A
git commit -m "Set GitHub repo owner"
git push
```

Wait ~1 minute for the deploy to finish. Refresh the live site.

## Step 5 — (Optional) Turn on the visual editor

If you want non-programmer collaborators to write articles and reviews using a Microsoft-Word-style editor, see the instructions in the [README Step 5](README.md#5-optional-enable-the-visual-editor-for-non-technical-contributors). It's free and takes ~5 min.

## Step 6 — (Optional) Add a custom domain later

If you buy `wikiendo.com` (or whatever) on Namecheap later, see [README Step 6](README.md#6-optional-point-a-custom-domain).

---

## What to do after setup

- **Read** the live wiki. Click around. Make sure everything looks right.
- **Add your first real article:** click ✏️ Edit on any page, or use the visual editor at `/admin/`.
- **Invite co-authors:** share the site URL and the [contributing.md](contributing.md) link.

If anything breaks or looks wrong, the files are just text in `~/Documents/endo-wiki/` on your Mac. Edit them, commit, push — site updates in ~1 minute.
