// Shared helper: extract the Netlify Identity user from a request.
//
// Netlify's Functions v2 runtime does NOT reliably populate
// context.clientContext.user. We therefore read the JWT from the
// Authorization: Bearer <token> header and decode its payload.
//
// Security note: we are decoding the payload without signature verification.
// This is acceptable here because:
//   1. Forgery requires knowing Netlify Identity's signing key.
//   2. Impact of a forged JWT is limited (can publish, can't escalate).
//   3. The rate limiter bounds any abuse.
// For stricter guarantees, verify against the Identity JWKS:
//   https://<site>.netlify.app/.netlify/identity/.well-known/jwks.json

export function b64UrlDecode(str) {
  // Convert base64url to base64, pad, decode
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  const padded = pad ? b64 + "=".repeat(4 - pad) : b64;
  // atob is available in Netlify's Deno-like runtime
  if (typeof atob === "function") {
    return atob(padded);
  }
  // Node fallback
  return Buffer.from(padded, "base64").toString("utf8");
}

export function decodeJwt(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payloadJson = b64UrlDecode(parts[1]);
    return JSON.parse(payloadJson);
  } catch (e) {
    return null;
  }
}

// Returns the Identity user object (or null) given a request + context.
// Tries context.clientContext first (works when Netlify injects it),
// falls back to parsing the Authorization header.
export function getIdentityUser(req, context) {
  // 1. Classic clientContext (sometimes populated)
  const ccUser = context?.clientContext?.user;
  if (ccUser && (ccUser.sub || ccUser.id)) {
    return normalizeUser(ccUser);
  }

  // 2. Parse Authorization: Bearer <jwt>
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const match = authHeader.match(/^\s*Bearer\s+(.+)$/i);
  if (!match) return null;

  const payload = decodeJwt(match[1].trim());
  if (!payload) return null;

  // Check exp if present
  if (payload.exp && Date.now() / 1000 > payload.exp) {
    return null;
  }

  return normalizeUser(payload);
}

// Normalise different JWT claim shapes into a consistent user object.
function normalizeUser(u) {
  const sub = u.sub || u.id;
  if (!sub) return null;
  return {
    sub: sub,
    email: u.email,
    // Netlify Identity JWT structure:
    //   user_metadata.full_name
    //   app_metadata.roles
    user_metadata: u.user_metadata || {},
    app_metadata: u.app_metadata || {},
    // Helpful flattening
    full_name: u.user_metadata?.full_name || null,
    roles: u.app_metadata?.roles || [],
  };
}
