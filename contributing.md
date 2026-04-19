# How to contribute to EndoWiki

**You don't need to know git, markdown, or any programming.** There are three ways to contribute, from easiest to most technical. Pick whichever you're comfortable with.

## Easiest: Use the visual editor (recommended for most people)

1. Click **[Edit in browser](/admin/)** in the top nav.
2. Sign in with your GitHub account (create one free at [github.com/signup](https://github.com/signup) if you don't have one — takes 60 seconds).
3. Pick what you want to do:
   - **New article** → "Articles" collection → "New Article"
   - **New course review** → "Course reviews" → "New Course review"
   - **New equipment review** → "Equipment reviews" → "New Equipment review"
   - **Edit existing** → click any item, make changes
4. Click **Save** → **Publish**. Your change goes live in ~1 minute.

The editor looks like Microsoft Word. Bold, italic, headings, links, images, lists — all as buttons. No raw text formatting required.

## Quick fix: Edit one page on GitHub

See a typo or want to add a paragraph to one existing article?

1. Scroll to the bottom of any article on EndoWiki.
2. Click **✏️ Edit this page on GitHub**.
3. GitHub shows the article in its web editor. Make your changes.
4. Scroll down, write a one-line summary of what you changed (e.g. *"fix typo in irrigation section"*).
5. Click **Commit changes**. Done — your edit is live in ~1 minute.

This needs a GitHub account but no other setup.

## For power users: Clone the repo

If you prefer your own editor (VS Code, Typora, iA Writer):

```bash
git clone https://github.com/YOUR-GITHUB-USERNAME/endo-wiki.git
cd endo-wiki
# edit files…
git add -A && git commit -m "Describe your change" && git push
```

A pull request is welcome but not required — push directly if you're a maintainer.

## What to contribute

- **New articles:** clinical topics, technique guides, glossary entries, case discussions.
- **Course reviews:** any endodontic CE course you've taken — residencies, masterclasses, online courses, hands-on workshops.
- **Equipment reviews:** anything you've bought or used substantially — apex locators, endomotors, microscopes, files, obturators, irrigation devices, imaging.
- **Edits:** fix typos, clarify unclear sentences, add references, update outdated information.
- **Discussion:** click 💬 Discuss at the bottom of any article to start a conversation.

## What NOT to contribute

- Patient-identifying information. Redact everything. A radiograph with a name visible is a data leak.
- Content copied from textbooks, paywalled journals, or other websites. Paraphrase and cite.
- Self-promotion disguised as articles or reviews. A review of *your own* course is a conflict of interest — disclose it or don't post it.
- Drug names with dosage recommendations without a clinical reference.

## Review process

Contributions are **not** pre-moderated — your change is live immediately. This is how Wikipedia works too, and it works because everyone is watching.

If you see a bad edit:
- Small: just fix it and commit a clarifying note.
- Large or malicious: open an issue (click 💬 Discuss on the article, or go directly to [the issues page](https://github.com/YOUR-GITHUB-USERNAME/endo-wiki/issues)). A maintainer will review.

Every edit is in git history forever — nothing is lost, and bad edits can be reverted with one click.

## Credit

You keep authorship of whatever you write. Content is licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) so others can build on it, as long as they credit you.

---

**Questions?** Open an [issue](https://github.com/YOUR-GITHUB-USERNAME/endo-wiki/issues) — someone will reply.
