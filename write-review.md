# How to write a review

The **easiest way** is the visual editor: click [**Edit in browser**](/admin/), sign in with GitHub, pick *Course reviews* or *Equipment reviews*, click *New*, fill the form. You can stop reading here.

This page is for people writing reviews directly in markdown.

## Structure of a review file

Every review has two parts: a JSON block with the structured data (rating, brand, price, pros, cons…) and a markdown body with the narrative. The review card at the top is rendered automatically from the JSON.

### Course review template

```markdown
# [Course name]

<script type="application/json" id="review-data">
{
  "kind": "course",
  "title": "Course name as you'd title it",
  "rating": 5,
  "author": "Dr. Your Name",
  "date": "2026-03",
  "provider": "Who ran it (institution or company)",
  "instructor": "Main instructor(s)",
  "location": "City, Country, or Online",
  "format": "In-person / online-live / online-self-paced / hybrid",
  "duration": "e.g. 3 days, 40 hours, 6 months",
  "price": "~€2,500 (CE credits included)",
  "date_taken": "2026-01",
  "pros": [
    "Specific, concrete pro",
    "Another specific pro"
  ],
  "cons": [
    "Specific con",
    "Another specific con"
  ],
  "would_recommend": true,
  "verdict": "One-sentence take."
}
</script>

<div id="review-card"></div>

## Who this is for

*(who will get the most out of this course — experience level, case types)*

## What it covered

*(bullet or narrative summary of the curriculum)*

## What worked

*(what the course did well — be specific)*

## What didn't

*(honest criticism, with specifics)*

## Verdict

*(would you recommend it? to whom? would you do it again?)*
```

### Equipment review template

```markdown
# [Brand Model]

<script type="application/json" id="review-data">
{
  "kind": "equipment",
  "title": "Brand Model",
  "rating": 4,
  "author": "Dr. Your Name",
  "date": "2026-03",
  "brand": "Brand",
  "model": "Model number / version",
  "category": "Apex locator / Endomotor / Microscope / File system / …",
  "price": "~$450 (USD)",
  "date_bought": "2025-10",
  "duration_used": "6 months of daily use",
  "pros": [
    "Specific pro with a concrete detail",
    "Another specific pro"
  ],
  "cons": [
    "Specific con",
    "Another specific con"
  ],
  "would_recommend": true,
  "verdict": "One-sentence take."
}
</script>

<div id="review-card"></div>

## What I was using before

*(important context for the comparison)*

## In use

*(how it actually performs day-to-day)*

## Reliability

*(any failures, warranty experience, build quality notes)*

## Value

*(price relative to alternatives, not just the absolute price)*

## Verdict

*(would you buy it again? who should, who shouldn't)*
```

## Rating scale (same for both kinds)

| Stars | Meaning |
| --- | --- |
| ★★★★★ | Would enthusiastically recommend. Essentially no significant complaints. |
| ★★★★☆ | Recommend with minor caveats. |
| ★★★☆☆ | Mixed — some will love it, some won't. Depends on use case. |
| ★★☆☆☆ | Would not recommend for most situations. |
| ★☆☆☆☆ | Actively regret. Avoid. |

Use the middle of the scale when it applies — 5-star inflation erodes trust in the whole site.

## Disclosure

If you have a conflict of interest — the manufacturer gave you the product, you're a paid speaker for them, you teach for the course — **say so at the top of the "What I was using before" section** (or equivalent). Something like:

> *Disclosure: Brand Inc. provided a review unit at no charge. They had no editorial input.*

Readers can weigh your take accordingly; they just need to know.

---

See also: [editorial guidelines](editorial-guidelines.md).
