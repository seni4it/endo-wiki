// Shared helper: verify the Netlify Identity user on a request.
//
// Why this file is more complex than a naive JWT decode:
//   - Netlify Identity signs JWTs with a per-instance HS256 secret that is
//     NOT exposed to v2 Functions at runtime.
//   - No JWKS endpoint exists (Identity is symmetric, not asymmetric).
//   - `context.clientContext.user` is unreliable in v2 Functions — sometimes
//     populated, sometimes not.
//
// The canonical way to verify a user is to call Identity's own `/user`
// endpoint with the same Authorization header. Identity validates the token
// against its private secret and returns the user object if valid, or 401.
// This is the same mechanism the official @netlify/functions Identity helpers
// use under the hood.

function getSiteBaseUrl(req) {
  // Prefer the request's own origin so this works across branch deploys,
  // preview URLs, and the production domain.
  try {
    const url = new URL(req.url);
    return `${url.protocol}//${url.host}`;
  } catch (e) {
    return "https://endo-wiki-31401.netlify.app";
  }
}

function extractBearer(req) {
  const h = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const m = h.match(/^\s*Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function normalizeUser(u) {
  const sub = u.sub || u.id;
  if (!sub) return null;
  return {
    sub: sub,
    email: u.email || null,
    user_metadata: u.user_metadata || {},
    app_metadata: u.app_metadata || {},
    full_name:
      u.user_metadata?.full_name ||
      u.user_metadata?.name ||
      null,
    roles: u.app_metadata?.roles || [],
  };
}

// Returns a verified user, or null if token is missing/invalid/expired.
// Verification is done by asking Identity to decode the token for us.
export async function getIdentityUser(req, context) {
  // 1. Prefer clientContext if Netlify injected it (v1 Lambda path)
  const ccUser = context?.clientContext?.user;
  if (ccUser && (ccUser.sub || ccUser.id)) {
    return normalizeUser(ccUser);
  }

  // 2. Extract the Bearer token and verify via Identity /user endpoint
  const token = extractBearer(req);
  if (!token) return null;

  const base = getSiteBaseUrl(req);
  try {
    const res = await fetch(`${base}/.netlify/identity/user`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      // 401 = bad/expired token; 404 = Identity not enabled
      return null;
    }
    const u = await res.json();
    return normalizeUser(u);
  } catch (e) {
    // Network / parsing error — treat as unauthenticated
    return null;
  }
}
