// GET /api/get?kind=article|course|equipment&slug=<slug>
// Public: anyone can read any entry.

import { getStore } from "@netlify/blobs";

const VALID_KINDS = new Set(["article", "course", "equipment"]);

export default async (req) => {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const slug = url.searchParams.get("slug");
  if (!VALID_KINDS.has(kind) || !slug) {
    return new Response(JSON.stringify({ error: "Missing or invalid kind/slug." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const store = getStore("content");
  const record = await store.get(`${kind}/${slug}`, { type: "json" });
  if (!record) {
    return new Response(JSON.stringify({ error: "Not found." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  // Do not expose the author's raw email publicly
  const { author_email, ...safe } = record;
  return new Response(JSON.stringify(safe), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=30, stale-while-revalidate=300",
    },
  });
};

export const config = {
  path: "/api/get",
};
