// GET /api/subject?kind=course|equipment&subject_slug=<slug>
//
// Returns all reviews for one subject. Uses the `__subject/<kind>/<slug>`
// index if present; otherwise falls back to scanning `__index/<kind>` and
// grouping by the base slug (pre-`--by-` portion). The fallback lets
// seeded content that predates the subject mechanism still group correctly.

import { getStore } from "@netlify/blobs";

const VALID_KINDS = new Set(["course", "equipment"]);

function json(status, data, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=15, stale-while-revalidate=60",
      ...headers,
    },
  });
}

function deriveSubjectSlug(slug) {
  // slug = "styleitaliano-masterclass--by-dr-smith" → "styleitaliano-masterclass"
  const i = String(slug || "").indexOf("--by-");
  return i >= 0 ? slug.slice(0, i) : slug;
}

async function gatherBySlugFallback(store, kind, subjectSlug) {
  const index = (await store.get(`__index/${kind}`, { type: "json" })) || { items: [] };
  const matching = index.items.filter(
    (it) => (it.subject_slug || deriveSubjectSlug(it.slug)) === subjectSlug
  );
  if (matching.length === 0) return null;
  // Load full records
  const reviews = await Promise.all(
    matching.map((it) => store.get(`${kind}/${it.slug}`, { type: "json" }))
  );
  const live = reviews.filter(Boolean);
  if (live.length === 0) return null;
  const ratings = live.map((r) => Number(r.rating) || 0).filter((r) => r > 0);
  const avg =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null;
  // Pick newest title as display title
  live.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  const firstWithImage = live.find((r) => r.image_url) || null;
  return {
    kind,
    subject_slug: subjectSlug,
    display_title: live[0].title,
    image_url: firstWithImage ? firstWithImage.image_url : "",
    avg_rating: avg,
    review_count: live.length,
    updated_at: live[0].updated_at,
    reviews: live,
  };
}

export default async (req) => {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const subjectSlug = url.searchParams.get("subject_slug");
  if (!VALID_KINDS.has(kind) || !subjectSlug) {
    return json(400, { error: "Missing or invalid kind/subject_slug." });
  }

  const store = getStore("content");

  // Primary path — the subject index built by publish.js
  const subject = await store.get(`__subject/${kind}/${subjectSlug}`, { type: "json" });
  if (subject) {
    const reviews = await Promise.all(
      (subject.reviews || []).map(async (r) => {
        const rec = await store.get(`${kind}/${r.slug}`, { type: "json" });
        if (!rec) return null;
        const { author_email, ...safe } = rec;
        return safe;
      })
    );
    return json(200, {
      kind: subject.kind,
      subject_slug: subject.subject_slug,
      display_title: subject.display_title,
      avg_rating: subject.avg_rating,
      review_count: subject.review_count,
      updated_at: subject.updated_at,
      reviews: reviews.filter(Boolean),
    });
  }

  // Fallback — seed data or entries without a subject index
  const built = await gatherBySlugFallback(store, kind, subjectSlug);
  if (!built) {
    return json(404, { error: "No reviews for this subject yet." });
  }
  // Strip emails on the way out
  built.reviews = built.reviews.map(({ author_email, ...rest }) => rest);
  return json(200, built);
};

export const config = {
  path: "/api/subject",
};
