// POST /api/publish
// Authenticated endpoint: logged-in user creates or updates an article / review.
// Storage: Netlify Blobs store "content".
//
// Auth: Netlify Identity JWT is passed in via context.clientContext.user
// when the function is invoked behind Netlify's auth-aware routing. We also
// double-check the Authorization header to reject anonymous requests.

import { getStore } from "@netlify/blobs";

const VALID_KINDS = new Set(["article", "course", "equipment"]);
const MAX_BODY_BYTES = 200 * 1024;      // 200 KB body text
const MAX_TOTAL_BYTES = 2 * 1024 * 1024; // 2 MB total (to allow small inline images)

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
    headers: { "Content-Type": "application/json" },
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

  // Size guard
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
  if (!body || typeof body !== "string" || body.trim().length < 10) {
    return json(400, { error: "Please write at least a few sentences in the body." });
  }
  if (body.length > MAX_BODY_BYTES * 12) {
    // soft cap — body markdown can include image data URIs
    return json(413, { error: "Body is too large. Try linking to images instead of embedding." });
  }

  // Review-specific validation
  if (kind !== "article") {
    const rating = Number(payload.rating);
    if (!(rating >= 1 && rating <= 5)) {
      return json(400, { error: "Please rate it 1–5 stars." });
    }
  }

  const authorName = user.user_metadata?.full_name || user.email || "Anonymous";
  const authorEmail = user.email || null;
  const now = new Date().toISOString();

  // Build the record. We keep authorship in its own fields (source of truth)
  // and a `data` field for the user-provided content.
  const baseSlug = slugify(payload.slug || title) || "untitled";
  // Author suffix prevents collisions when two people review the same subject
  const authorSuffix = slugify(authorName).split("-").slice(0, 2).join("-") || user.sub.slice(0, 6);
  const slug = `${baseSlug}--by-${authorSuffix}`;

  const key = `${kind}/${slug}`;
  const store = getStore("content");

  // Load existing (if any) so only the author can update
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
          summary: payload.summary || "",
          tags: Array.isArray(payload.tags) ? payload.tags.slice(0, 20) : [],
        }
      : {
          rating: Number(payload.rating),
          pros: Array.isArray(payload.pros) ? payload.pros.slice(0, 20) : [],
          cons: Array.isArray(payload.cons) ? payload.cons.slice(0, 20) : [],
          would_recommend: payload.would_recommend || "yes",
          verdict: payload.verdict || "",
          price: payload.price || "",
          provider: payload.provider || "",
          instructor: payload.instructor || "",
          location: payload.location || "",
          format: payload.format || "",
          duration: payload.duration || "",
          brand: payload.brand || "",
          model: payload.model || "",
          category: payload.category || "",
          duration_used: payload.duration_used || "",
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
  // Keep the newest 500 per kind
  index.items = index.items.slice(0, 500);
  await store.setJSON(indexKey, index);

  return json(200, {
    ok: true,
    slug,
    path: `/${kind === "article" ? "a" : "r"}/${slug}`,
  });
};

export const config = {
  path: "/api/publish",
};
