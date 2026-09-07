// Splash Sports' own auth gateway, not raw Cognito — confirmed from a
// captured browser request. Login (api.auth.splashsports.com/universal-auth/login)
// is CAPTCHA-gated and can't be automated; this refresh endpoint is not, so
// it's the part that runs unattended. The request body carries the refresh
// token plus the current (possibly just-expired) ID token; the response is a
// new ID token. The response's `expiresIn` doesn't match the token's own
// `exp`/`iat` gap, so the JWT's `exp` claim is treated as authoritative.
import { browserLikeHeaders } from "./browserHeaders";

const REFRESH_URL = "https://api.auth.splashsports.com/universal-auth/refresh";

interface StoredAuth {
  idToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface RefreshResponse {
  accessToken: string;
  refreshToken?: string;
}

const AUTH_KV_KEY = "auth";
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

function decodeJwtExpiryMs(jwt: string): number {
  const payload = jwt.split(".")[1];
  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const json = atob(base64);
  const { exp } = JSON.parse(json) as { exp: number };
  return exp * 1000;
}

async function callRefresh(refreshToken: string, currentIdToken: string): Promise<StoredAuth> {
  const response = await fetch(REFRESH_URL, {
    method: "POST",
    headers: {
      ...browserLikeHeaders(),
      Accept: "application/json",
      "Content-Type": "application/json",
      "splash-accept-version": "3",
      "x-app-platform": "web-v2",
      "x-app-version": "0.0.0",
    },
    body: JSON.stringify({ refreshToken, accessToken: currentIdToken }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Splash auth refresh failed (refresh token likely expired — update the ` +
        `SPLASH_REFRESH_TOKEN secret): ${response.status} ${text}`.trim(),
    );
  }

  const body = (await response.json()) as RefreshResponse;
  return {
    idToken: body.accessToken,
    refreshToken: body.refreshToken ?? refreshToken,
    expiresAt: decodeJwtExpiryMs(body.accessToken),
  };
}

// Used by the /api/refresh-token endpoint (see index.ts) when a fresh
// refresh token is captured from the browser. Setting expiresAt to 0 forces
// the next getValidIdToken() call to actually use the new refresh token
// rather than an old cached ID token. Deliberately keeps whatever ID token is
// already cached (even though it's about to be treated as stale) — Splash's
// refresh endpoint requires a structurally valid `accessToken` alongside the
// refresh token and rejects an empty one outright (confirmed: a real but
// hours-expired token was accepted; an empty string was not), so preserving
// it gives the next refresh the best chance of working. Only a genuine
// first-ever bootstrap (KV never populated) has nothing to fall back on here.
export async function setRefreshToken(env: Env, refreshToken: string): Promise<void> {
  const existing = await env.SPLASH_STANDINGS_KV.get<StoredAuth>(AUTH_KV_KEY, "json");
  const auth: StoredAuth = { idToken: existing?.idToken ?? "", refreshToken, expiresAt: 0 };
  await env.SPLASH_STANDINGS_KV.put(AUTH_KV_KEY, JSON.stringify(auth));
}

export async function getValidIdToken(env: Env): Promise<string> {
  const stored = await env.SPLASH_STANDINGS_KV.get<StoredAuth>(AUTH_KV_KEY, "json");

  if (stored && stored.expiresAt - REFRESH_BUFFER_MS > Date.now()) {
    return stored.idToken;
  }

  // Splash's refresh endpoint requires a structurally valid `accessToken`
  // alongside the refresh token — confirmed empirically it rejects an empty
  // string with "accessToken should not be empty", but accepts one that's
  // real but expired. So a true cold start (nothing cached yet at all) can't
  // self-bootstrap: KV needs seeding once with a real captured ID token
  // (see README's "Updating the refresh token").
  const auth = await callRefresh(stored?.refreshToken ?? env.SPLASH_REFRESH_TOKEN, stored?.idToken ?? "");
  await env.SPLASH_STANDINGS_KV.put(AUTH_KV_KEY, JSON.stringify(auth));
  return auth.idToken;
}
