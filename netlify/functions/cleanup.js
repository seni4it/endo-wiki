// POST /api/cleanup — secret-gated admin endpoint.
// Rebuilds __index/<kind> from the actual records, dropping entries whose
// records have been deleted. Useful after manual admin cleanups.
//
// Auth: requires x-admin-secret header matching BOOTSTRAP_SECRET env var.

import { getStore } from "@netlify/blobs";

const KINDS = ["article", "course", "equipment"];

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only" });
  const provided = req.headers.get("x-admin-secret");
  const expected = process.env.BOOTSTRAP_SECRET;
  if (!expected || provided !== expected) {
    return json(401, { error: "Unauthorized" });
  }

  const store = getStore("content");
  const report = {};

  for (const kind of KINDS) {
    const index = (await store.get(`__index/${kind}`, { type: "json" })) || { items: [] };
    const surviving = [];
    const dropped = [];

    for (const summary of index.items) {
      const rec = await store.get(`${kind}/${summary.slug}`, { type: "json" });
      if (rec) surviving.push(summary);
      else dropped.push(summary.slug);
    }

    await store.setJSON(`__index/${kind}`, { items: surviving });
    report[kind] = { kept: surviving.length, dropped: dropped.length, dropped_slugs: dropped };
  }

  // Also rebuild per-subject indexes to drop orphan reviews
  for (const kind of ["course", "equipment"]) {
    const subjectIndex = (await store.get(`__index/subjects/${kind}`, { type: "json" })) || { items: [] };
    const subjSurviving = [];
    for (const s of subjectIndex.items) {
      const subj = await store.get(`__subject/${kind}/${s.subject_slug}`, { type: "json" });
      if (!subj) continue;
      const liveReviews = [];
      for (const r of (subj.reviews || [])) {
        const rec = await store.get(`${kind}/${r.slug}`, { type: "json" });
        if (rec) liveReviews.push(r);
      }
      if (liveReviews.length === 0) {
        // No reviews left — remove the subject
        continue;
      }
      subj.reviews = liveReviews;
      subj.review_count = liveReviews.length;
      const ratings = liveReviews.map((r) => Number(r.rating) || 0).filter((v) => v > 0);
      subj.avg_rating =
        ratings.length > 0
          ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
          : null;
      await store.setJSON(`__subject/${kind}/${s.subject_slug}`, subj);
      subjSurviving.push({
        subject_slug: s.subject_slug,
        display_title: subj.display_title,
        avg_rating: subj.avg_rating,
        review_count: subj.review_count,
        updated_at: subj.updated_at,
      });
    }
    await store.setJSON(`__index/subjects/${kind}`, { items: subjSurviving });
    report["subjects_" + kind] = { kept: subjSurviving.length };
  }

  return json(200, { ok: true, report });
};

export const config = {
  path: "/api/cleanup",
};
