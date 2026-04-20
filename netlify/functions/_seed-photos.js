// One-shot: attach stock image_urls to the seeded reviews so subject/review
// pages have hero photos immediately. Secret-gated. Delete after running.

import { getStore } from "@netlify/blobs";

const PHOTOS = {
  // Equipment reviews
  "equipment/woodpex-iii-apex-locator--by-endowiki-seed":
    "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=1200&q=80",
  "equipment/x-smart-iq-endomotor--by-endowiki-seed":
    "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=1200&q=80",
  "equipment/zeiss-extaro-300-microscope--by-endowiki-seed":
    "https://images.unsplash.com/photo-1582719471384-894fbb16e074?w=1200&q=80",
  // Course reviews
  "course/styleitaliano-endodontics-masterclass--by-endowiki-seed":
    "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=1200&q=80",
  "course/endo-mastery-online-ce--by-endowiki-seed":
    "https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=1200&q=80",
};

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405 });
  }
  if (req.headers.get("x-admin-secret") !== process.env.BOOTSTRAP_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const store = getStore("content");
  const updates = {};

  for (const [key, url] of Object.entries(PHOTOS)) {
    const rec = await store.get(key, { type: "json" });
    if (!rec) { updates[key] = "missing"; continue; }
    rec.image_url = url;
    await store.setJSON(key, rec);

    // Also update the subject aggregation if present
    const [kind, slug] = key.split("/");
    const subjectSlug = slug.split("--by-")[0];
    const subjectKey = `__subject/${kind}/${subjectSlug}`;
    const subject = await store.get(subjectKey, { type: "json" });
    if (subject) {
      if (!subject.image_url) subject.image_url = url;
      const i = (subject.reviews || []).findIndex((r) => r.slug === slug);
      if (i >= 0) subject.reviews[i].image_url = url;
      await store.setJSON(subjectKey, subject);
    }
    updates[key] = "updated";
  }

  return new Response(JSON.stringify({ ok: true, updates }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const config = { path: "/api/_seed-photos" };
