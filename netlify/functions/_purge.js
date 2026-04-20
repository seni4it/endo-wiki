// One-shot admin purge of specific slugs. Removes both the record and any
// trace of it in indexes. Secret-gated. Delete this file when done.

import { getStore } from "@netlify/blobs";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405 });
  }
  const provided = req.headers.get("x-admin-secret");
  if (!process.env.BOOTSTRAP_SECRET || provided !== process.env.BOOTSTRAP_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await req.json();
  const { kind, slug } = body;
  if (!kind || !slug) {
    return new Response(JSON.stringify({ error: "Need kind and slug" }), { status: 400 });
  }

  const store = getStore("content");
  const before = await store.get(`${kind}/${slug}`, { type: "json" });
  await store.delete(`${kind}/${slug}`);
  const after = await store.get(`${kind}/${slug}`, { type: "json" });

  // Rebuild index
  const index = (await store.get(`__index/${kind}`, { type: "json" })) || { items: [] };
  const filtered = index.items.filter((i) => i.slug !== slug);
  await store.setJSON(`__index/${kind}`, { items: filtered });

  return new Response(
    JSON.stringify({ ok: true, before: !!before, after: !!after, remaining: filtered.length }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};

export const config = { path: "/api/_purge" };
