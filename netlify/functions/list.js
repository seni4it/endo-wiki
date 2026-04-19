// GET /api/list?kind=article|course|equipment
// Public: returns a summary of all entries of that kind, newest first.

import { getStore } from "@netlify/blobs";

const VALID_KINDS = new Set(["article", "course", "equipment"]);

export default async (req) => {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  if (!VALID_KINDS.has(kind)) {
    return new Response(JSON.stringify({ error: "Invalid kind." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const store = getStore("content");
  const index = (await store.get(`__index/${kind}`, { type: "json" })) || { items: [] };
  return new Response(JSON.stringify({ kind, items: index.items }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=20, stale-while-revalidate=120",
    },
  });
};

export const config = {
  path: "/api/list",
};
