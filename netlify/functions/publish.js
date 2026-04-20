// POST /api/publish
//
// Authenticated endpoint. Stores entries in Netlify Blobs.
//
// Slug strategy for reviews:
//   - `subject_slug` = base slug derived from the title (shared across reviewers)
//   - `slug`         = `<subject_slug>--by-<author-hint>` (unique per author)
// This lets multiple people review the same motor / course / microscope and
// all their reviews are grouped under the same subject page (/p/<subject_slug>).
//
// Auth: we decode the Netlify Identity JWT from the Authorization header
// because context.clientContext.user is unreliable in v2 Functions. See
// _lib/identity.js for the full rationale.

import { getStore } from "@netlify/blobs";
import { getIdentityUser } from "./_lib/identity.js";

const VALID_KINDS = new Set(["article", "course", "equipment"]);
const MAX_BODY_BYTES = 200 * 1024;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024;
const RATE_LIMIT_PER_HOUR = 20;

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export default async (req, context) => {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const user = await getIdentityUser(req, context);
  if (!user || !user.sub) {
    return json(401, { error: "Please log in to publish." });
  }
  if (!user.email) {
    return json(403, { error: "Please confirm your email before publishing." });
  }

  const text = await req.text();
  if (text.length > MAX_TOTAL_BYTES) {
    return json(413, { error: "Entry is too large (> 2 MB including images)." });
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch (e) {
    return json(400, { error: "Invalid JSON body." });
  }

  const { kind, title, body } = payload;
  if (!VALID_KINDS.has(kind)) {
    return json(400, { error: "Unknown entry kind." });
  }
  if (!title || typeof title !== "string" || title.trim().length < 2) {
    return json(400, { error: "A title is required." });
  }
  if (title.length > 200) {
    return json(400, { error: "Title is too long (max 200 characters)." });
  }
  if (!body || typeof body !== "string" || body.trim().length < 10) {
    return json(400, { error: "Please write at least a few sentences in the body." });
  }
  if (body.length > MAX_BODY_BYTES * 12) {
    return json(413, { error: "Body is too large. Try linking to images instead of embedding." });
  }

  if (kind !== "article") {
    const rating = Number(payload.rating);
    if (!(rating >= 1 && rating <= 5)) {
      return json(400, { error: "Please rate it 1–5 stars." });
    }
  }

  const store = getStore("content");

  // Rate limiting
  const hourBucket = Math.floor(Date.now() / 3600000);
  const rateKey = `__rate/${user.sub}/${hourBucket}`;
  const rateRec = (await store.get(rateKey, { type: "json" })) || { count: 0 };
  if (rateRec.count >= RATE_LIMIT_PER_HOUR) {
    return json(429, {
      error:
        `Rate limit reached (${RATE_LIMIT_PER_HOUR} entries per hour). ` +
        `Please try again in a little while.`,
    });
  }

  const authorName =
    user.full_name ||
    user.user_metadata?.full_name ||
    (user.email ? user.email.split("@")[0] : "Anonymous");
  const authorEmail = user.email;
  const now = new Date().toISOString();

  // Subject slug — shared across reviewers writing about the same thing.
  // For articles, there's no author suffix (articles are collaborative later,
  // but for now one entry per title+author).
  const subjectSlug = slugify(payload.subject_slug || title) || "untitled";
  const authorSuffix = (slugify(authorName).split("-").slice(0, 2).join("-") || user.sub.slice(0, 6));
  const slug =
    kind === "article"
      ? `${subjectSlug}--by-${authorSuffix}`
      : `${subjectSlug}--by-${authorSuffix}`;

  const key = `${kind}/${slug}`;

  const existing = await store.get(key, { type: "json" });
  if (existing && existing.author_id !== user.sub) {
    return json(403, {
      error:
        "Another author has already published an entry with this slug. " +
        "Please edit your own entry or choose a different title.",
    });
  }

  const record = {
    kind,
    slug,
    subject_slug: subjectSlug,
    title: title.trim(),
    body: body,
    author_id: user.sub,
    author_name: authorName,
    author_email: authorEmail,
    created_at: existing?.created_at || now,
    updated_at: now,
    ...(kind === "article"
      ? {
          summary: typeof payload.summary === "string" ? payload.summary.slice(0, 500) : "",
          tags: Array.isArray(payload.tags) ? payload.tags.slice(0, 20) : [],
        }
      : {
          rating: Number(payload.rating),
          pros: Array.isArray(payload.pros) ? payload.pros.slice(0, 20) : [],
          cons: Array.isArray(payload.cons) ? payload.cons.slice(0, 20) : [],
          would_recommend: payload.would_recommend || "yes",
          verdict: typeof payload.verdict === "string" ? payload.verdict.slice(0, 300) : "",
          price: typeof payload.price === "string" ? payload.price.slice(0, 100) : "",
          provider: typeof payload.provider === "string" ? payload.provider.slice(0, 200) : "",
          instructor: typeof payload.instructor === "string" ? payload.instructor.slice(0, 200) : "",
          location: typeof payload.location === "string" ? payload.location.slice(0, 200) : "",
          format: typeof payload.format === "string" ? payload.format.slice(0, 60) : "",
          duration: typeof payload.duration === "string" ? payload.duration.slice(0, 100) : "",
          brand: typeof payload.brand === "string" ? payload.brand.slice(0, 100) : "",
          model: typeof payload.model === "string" ? payload.model.slice(0, 100) : "",
          category: typeof payload.category === "string" ? payload.category.slice(0, 60) : "",
          duration_used: typeof payload.duration_used === "string" ? payload.duration_used.slice(0, 200) : "",
          // Hero image. Two forms accepted:
          //  - data:image/... URI (small; stored inline; ≤ 400 KB after base64)
          //  - https://... URL (stored as-is)
          image_url: (() => {
            const v = typeof payload.image_url === "string" ? payload.image_url.trim() : "";
            if (!v) return "";
            if (v.startsWith("data:image/") && v.length <= 400 * 1024) return v;
            if (/^https:\/\/[^\s]+$/.test(v) && v.length <= 500) return v;
            return "";
          })(),
        }),
  };

  await store.setJSON(key, record);

  // Per-kind index (for listings)
  const indexKey = `__index/${kind}`;
  const index = (await store.get(indexKey, { type: "json" })) || { items: [] };
  const existingIdx = index.items.findIndex((it) => it.slug === slug);
  const summary = {
    slug,
    subject_slug: subjectSlug,
    title: record.title,
    author_name: record.author_name,
    updated_at: record.updated_at,
    ...(kind !== "article" ? { rating: record.rating } : {}),
  };
  if (existingIdx >= 0) index.items[existingIdx] = summary;
  else index.items.unshift(summary);
  index.items = index.items.slice(0, 500);
  await store.setJSON(indexKey, index);

  // Per-subject index (for "all reviews of X" page) — only for reviews
  if (kind !== "article") {
    const subjectKey = `__subject/${kind}/${subjectSlug}`;
    const subject = (await store.get(subjectKey, { type: "json" })) || {
      kind,
      subject_slug: subjectSlug,
      display_title: record.title,
      image_url: "",
      reviews: [],
    };
    // First submitter sets the canonical photo; later reviewers only replace
    // it if the subject didn't have one yet.
    if (!subject.image_url && record.image_url) {
      subject.image_url = record.image_url;
    }
    // Upsert this author's review in the subject's list
    const i = subject.reviews.findIndex((r) => r.author_id === user.sub);
    const reviewSummary = {
      slug,
      author_id: user.sub,
      author_name: record.author_name,
      rating: record.rating,
      verdict: record.verdict,
      updated_at: record.updated_at,
      image_url: record.image_url || "",
    };
    if (i >= 0) subject.reviews[i] = reviewSummary;
    else subject.reviews.unshift(reviewSummary);

    // Recompute average rating
    const ratings = subject.reviews.map((r) => Number(r.rating) || 0).filter((r) => r > 0);
    subject.avg_rating =
      ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null;
    subject.review_count = subject.reviews.length;
    // Keep the most recent non-empty title as the display title
    subject.display_title = record.title;
    subject.updated_at = now;
    await store.setJSON(subjectKey, subject);

    // Per-kind subject index (for browse page later)
    const subjectIndexKey = `__index/subjects/${kind}`;
    const subjectIndex = (await store.get(subjectIndexKey, { type: "json" })) || { items: [] };
    const j = subjectIndex.items.findIndex((s) => s.subject_slug === subjectSlug);
    const subjectSummary = {
      subject_slug: subjectSlug,
      display_title: subject.display_title,
      avg_rating: subject.avg_rating,
      review_count: subject.review_count,
      updated_at: subject.updated_at,
    };
    if (j >= 0) subjectIndex.items[j] = subjectSummary;
    else subjectIndex.items.unshift(subjectSummary);
    subjectIndex.items = subjectIndex.items.slice(0, 500);
    await store.setJSON(subjectIndexKey, subjectIndex);
  }

  // Increment rate counter on success
  rateRec.count += 1;
  await store.setJSON(rateKey, rateRec);

  return json(200, {
    ok: true,
    slug,
    subject_slug: subjectSlug,
    path: `/${kind === "article" ? "a" : "r"}/${slug}`,
    subject_path: kind !== "article" ? `/p/${kind}/${subjectSlug}` : null,
  });
};

export const config = {
  path: "/api/publish",
};
