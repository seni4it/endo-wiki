// GET /api/search?q=<query>&kind=<kind,...>
//
// Simple, relevance-ranked search across articles, course reviews, and
// equipment reviews. No external search service — we scan Blobs directly.
// Scales cleanly to ~1,000 entries. Beyond that, switch to Meilisearch.
//
// Scoring:
//   - Token match in title        +10
//   - Token match in summary      +5
//   - Token match in verdict      +4
//   - Token match in body         +1
//   - Token match in author_name  +2
//   - Multi-token bonus (phrase hit in title)  +5
//
// Returns top 20 results with a short snippet around the first body match.

import { getStore } from "@netlify/blobs";

const KINDS = ["article", "course", "equipment"];
const STOP = new Set([
  "the","a","an","and","or","but","of","in","on","at","to","for","by","with",
  "is","are","was","were","be","been","being","it","its","this","that","these",
  "those","i","you","he","she","we","they","as","from","into","about","how",
  "what","when","which","who","whom","whose","why",
]);

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

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9\s-]+/g, " ");   // keep alphanumerics, spaces, hyphens
}

function tokenize(s) {
  return normalize(s)
    .split(/\s+/)
    .filter((t) => t && t.length > 1 && !STOP.has(t));
}

function snippet(body, qNorm, maxLen = 180) {
  if (!body) return "";
  const bodyNorm = normalize(body);
  const idx = bodyNorm.indexOf(qNorm);
  let start, end;
  if (idx === -1) {
    // Fall back to first matching individual token
    const tokens = tokenize(qNorm);
    let best = -1;
    for (const t of tokens) {
      const i = bodyNorm.indexOf(t);
      if (i !== -1 && (best === -1 || i < best)) best = i;
    }
    if (best === -1) return body.slice(0, maxLen).trim() + (body.length > maxLen ? "…" : "");
    start = Math.max(0, best - 60);
    end = Math.min(body.length, best + maxLen - 60);
  } else {
    start = Math.max(0, idx - 60);
    end = Math.min(body.length, idx + maxLen - 60);
  }
  let out = body.slice(start, end).replace(/\s+/g, " ").trim();
  if (start > 0) out = "…" + out;
  if (end < body.length) out = out + "…";
  return out;
}

function scoreRecord(record, tokens, qNorm) {
  const titleNorm = normalize(record.title);
  const summaryNorm = normalize(record.summary || "");
  const verdictNorm = normalize(record.verdict || "");
  const bodyNorm = normalize(record.body || "");
  const authorNorm = normalize(record.author_name || "");

  let score = 0;
  let hits = 0;

  for (const t of tokens) {
    if (titleNorm.includes(t)) { score += 10; hits++; }
    if (summaryNorm.includes(t)) { score += 5; hits++; }
    if (verdictNorm.includes(t)) { score += 4; hits++; }
    if (bodyNorm.includes(t)) { score += 1; hits++; }
    if (authorNorm.includes(t)) { score += 2; hits++; }
  }

  // Phrase bonus — complete query found in title
  if (qNorm && titleNorm.includes(qNorm)) score += 5;

  // Require at least one token hit to count as a match
  return hits > 0 ? score : 0;
}

export default async (req) => {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const kindParam = url.searchParams.get("kind") || "";
  const requestedKinds = kindParam
    ? kindParam.split(",").filter((k) => KINDS.includes(k))
    : KINDS;
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));

  if (!q) {
    return json(200, { q: "", results: [], total: 0 });
  }
  if (q.length > 120) {
    return json(400, { error: "Query is too long (max 120 characters)." });
  }

  const tokens = tokenize(q);
  const qNorm = normalize(q);
  if (tokens.length === 0) {
    return json(200, { q, results: [], total: 0, note: "Query only contained common words; please use a more specific term." });
  }

  const store = getStore("content");
  const results = [];

  for (const kind of requestedKinds) {
    const index = (await store.get(`__index/${kind}`, { type: "json" })) || { items: [] };
    // Fetch each record in parallel for this kind
    const recs = await Promise.all(
      index.items.map(async (summary) => {
        try {
          const rec = await store.get(`${kind}/${summary.slug}`, { type: "json" });
          return rec ? { ...rec, kind } : null;
        } catch (e) {
          return null;
        }
      })
    );

    for (const rec of recs) {
      if (!rec) continue;
      const score = scoreRecord(rec, tokens, qNorm);
      if (score === 0) continue;

      results.push({
        kind,
        slug: rec.slug,
        title: rec.title,
        author_name: rec.author_name,
        summary: rec.summary || rec.verdict || "",
        rating: rec.rating,
        score,
        snippet: snippet(rec.body || rec.summary || rec.verdict, qNorm),
        updated_at: rec.updated_at,
      });
    }
  }

  // Sort by score desc, then recency
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return String(b.updated_at).localeCompare(String(a.updated_at));
  });

  return json(200, {
    q,
    results: results.slice(0, limit),
    total: results.length,
  });
};

export const config = {
  path: "/api/search",
};
