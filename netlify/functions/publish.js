// POST /api/publish
//
// Authenticated endpoint: logged-in, email-verified user creates or updates
// an article / review. Storage: Netlify Blobs store "content".
//
// ── Security ──────────────────────────────────────────────────────────
// Auth: context.clientContext.user is populated by Netlify when a valid
//   Identity JWT is passed in the Authorization header. Netlify only issues
//   JWTs to email-confirmed users, so anonymous and unconfirmed accounts
//   cannot reach the rest of this function.
// Authorization: row-level ownership — only the original author can update
//   an existing entry with the same slug.
// Rate limit: 20 entries per rolling hour per user (prevents abuse).
// Size limits: 200 KB body prose, 2 MB total payload (incl. small images).
// ──────────────────────────────────────────────────────────────────────

import { getStore } from "@netlify/blobs";

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

  // Auth check
  const user = context.clientContext?.user;
  if (!user || !user.sub) {
    return json(401, { error: "Please log in to publish." });
  }

  // Defense-in-depth: require email to be confirmed. Netlify won't issue a JWT
  // to an unconfirmed user by default, but this guards against misconfiguration.
  // Netlify populates `email` only for confirmed users; `app_metadata.provider`
  // also tells us which auth path the user took.
  if (!user.email) {
    return json(403, { error: "Please confirm your email before publishing." });
  }

  // Size guard (body read as text, then JSON-parsed)
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

  // ── Rate limiting (per-user, per-hour) ─────────────────────────────
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

  const authorName = user.user_metadata?.full_name || user.email.split("@")[0] || "Anonymous";
  const authorEmail = user.email;
  const now = new Date().toISOString();

  const baseSlug = slugify(payload.slug || title) || "untitled";
  const authorSuffix = slugify(authorName).split("-").slice(0, 2).join("-") || user.sub.slice(0, 6);
  const slug = `${baseSlug}--by-${authorSuffix}`;

  const key = `${kind}/${slug}`;

  // Row-level ownership: only original author can update
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
        }),
  };

  await store.setJSON(key, record);

  // Maintain a lightweight index for listing
  const indexKey = `__index/${kind}`;
  const index = (await store.get(indexKey, { type: "json" })) || { items: [] };
  const existingIdx = index.items.findIndex((it) => it.slug === slug);
  const summary = {
    slug,
    title: record.title,
    author_name: record.author_name,
    updated_at: record.updated_at,
    ...(kind !== "article" ? { rating: record.rating } : {}),
  };
  if (existingIdx >= 0) index.items[existingIdx] = summary;
  else index.items.unshift(summary);
  index.items = index.items.slice(0, 500);
  await store.setJSON(indexKey, index);

  // Increment rate counter AFTER successful write
  rateRec.count += 1;
  await store.setJSON(rateKey, rateRec);

  return json(200, {
    ok: true,
    slug,
    path: `/${kind === "article" ? "a" : "r"}/${slug}`,
  });
};

export const config = {
  path: "/api/publish",
};
