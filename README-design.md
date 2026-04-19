# EndoWiki Design System

Version 2 — implemented April 2026.

## Aesthetic direction

**Ink-and-paper editorial.** The visual language is modelled on specialist print publications — the kind endodontists already trust (NEJM, JOE, Monocle). It is serious, warm, and deeply readable. It is not a SaaS dashboard.

The design resists the common AI-generated web aesthetic: no purple gradients, no Inter everywhere, no three-column rounded-card grids. Every choice is specific to the context of specialist clinical reading.

## Typography

| Role | Family | Rationale |
|------|--------|-----------|
| Display / headings | **Lora** (serif) | Literary, warm, with strong character at large sizes. Excellent for long article titles. |
| Body / long-form prose | **Source Serif 4** (optical-size serif) | Designed specifically for reading at text sizes; wide optical size range means it works from 14px captions to 20px lead paragraphs. |
| UI chrome | **DM Sans** | Geometric, slightly humanist, neutral enough to stay out of the way of the editorial type. Distinct from the overused Inter/Roboto pairing. |
| Code | **JetBrains Mono** / ui-monospace fallback | Standard; clinical articles may include instrument codes or protocol tables. |

All fonts are imported from Google Fonts with `display=swap`. Body text is 18px / 1.75 line-height on article pages — generous for extended reading sessions.

## Color palette

All values live in CSS custom properties on `:root` in `assets/styles.css`.

| Token | Value | Use |
|-------|-------|-----|
| `--ink` | `#1a2438` | Primary text, nav background, headings |
| `--ink-light` | `#2d3d56` | Secondary headings, hover states |
| `--ink-muted` | `#4a5a72` | Body text, subheadings |
| `--ink-faint` | `#7a8a9e` | Captions, metadata, placeholders |
| `--oxblood` | `#8B2B2B` | Primary accent: CTAs, links, active states, the nav border stripe |
| `--oxblood-dk` | `#6d1f1f` | Hover states for oxblood elements |
| `--oxblood-lt` | `#f5eded` | Blockquote backgrounds, tinted surfaces |
| `--teal` | `#1a6b6b` | Course review badges |
| `--amber` | `#b5611a` | Equipment review badges |
| `--bg` | `#faf9f6` | Page background — warm off-white, not stark |
| `--surface` | `#ffffff` | Cards, modals |
| `--star` | `#c28a18` | Star ratings — warm gold, not garish yellow |

The three-stripe rule: in any given component, use at most **ink + one accent + one neutral**. Never more than three colours in a single component.

## Layout

- **Reading width:** Article and review pages cap at 740–780px. This yields ~70 characters per line — the typographic sweet spot.
- **Home page:** Caps at 1200px for the wide content grid, narrowing to 740px for prose.
- **Spacing:** 8px base scale via `--s1` through `--s10` tokens. All spacing in components uses these tokens — no magic numbers.
- **The nav:** Sticky, ink-dark, with a 3px oxblood bottom border. Creates a strong anchor that makes every page feel like it belongs to the same publication.

## Motion

- Page load: `fadeUp` animation (`opacity 0→1`, `translateY 16px→0`) staggered across hero elements via `anim-delay-1` through `anim-delay-4`. Each step is 80ms apart.
- Cards: `translateY(-2px)` on hover with a box-shadow reveal — restrained, functional.
- Loading spinner: CSS-only `spin` keyframe on a half-border circle.
- All animations respect `prefers-reduced-motion: reduce` — the media query disables every animation and transition when set.
- Maximum animation duration: 500ms. Nothing lingers.

## Page-by-page notes

### index.html
Loads three feeds in parallel via `fetch('/api/list?kind=...')`. While loading, each grid shows a single `feed-loading` state. On empty, shows a `feed-empty` with a "be the first" CTA. Stat counters in the hero update from live API response counts — they show `—` until loaded, never `0`.

### article.html
Full reading experience. Serif body at 18px/1.75. Byline strip between header and body. The `article-body` class governs all rendered Toast UI HTML: headings, blockquotes, code, tables, images all have explicit styles. No external CSS dependency beyond the shared stylesheet.

### review.html
Hero card contains: kind badge, title, byline, star rating block, facts grid, pros/cons columns, verdict. The verdict `data-label` attribute drives a CSS `::before` pseudo-element for the recommendation label — no extra markup needed. Body prose (if any) follows below a ruled divider.

### compose.html
Three-step compose flow. The progress indicator updates via `compose.js` (existing logic unchanged — only class names aligned to the new system: `cp-step`, `cp-step-num`, etc.). The `callout` class retains the old class names (`callout.ok`, `callout.warn`) for backward compatibility with `compose.js`. All form element IDs are preserved exactly — `compose.js` queries by ID.

## Adding new pages

1. Include `assets/styles.css`.
2. Use `.site-nav` / `.site-footer` markup for nav and footer (copy from `index.html`).
3. Use `--font-display` for headings, `--font-body` for prose, `--font-ui` for labels/buttons.
4. Use CSS tokens for all colours and spacing — never hardcode hex values or px margins.
5. Wrap page content in a max-width container (`max-width: 740px` for reading pages, `1200px` for listing pages).

## What not to do

- Do not introduce Inter, Roboto, or system-font stacks for display text.
- Do not add purple, indigo, or blue as accent colours — the oxblood/teal/amber palette is complete.
- Do not add rounded cards with multiple box-shadows — the current shadow scale (`--shadow-xs` through `--shadow-xl`) is sufficient.
- Do not add animation delays longer than 400ms or durations longer than 500ms.
- Do not hardcode colours. Every colour must be a `var(--...)` token.
