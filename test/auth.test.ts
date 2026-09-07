import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { setRefreshToken } from "../src/auth";

const AUTH_KV_KEY = "auth";

describe("setRefreshToken", () => {
  beforeEach(async () => {
    await env.SPLASH_STANDINGS_KV.delete(AUTH_KV_KEY);
  });

  it("preserves the existing cached idToken rather than clearing it", async () => {
    await env.SPLASH_STANDINGS_KV.put(
      AUTH_KV_KEY,
      JSON.stringify({ idToken: "old-id-token", refreshToken: "old-refresh", expiresAt: 123 }),
    );

    await setRefreshToken(env, "new-refresh-token");

    const stored = await env.SPLASH_STANDINGS_KV.get<{ idToken: string; refreshToken: string; expiresAt: number }>(
      AUTH_KV_KEY,
      "json",
    );
    // Splash's refresh endpoint rejects an empty accessToken outright but
    // tolerates an expired-but-real one, so this must never regress to "".
    expect(stored?.idToken).toBe("old-id-token");
    expect(stored?.refreshToken).toBe("new-refresh-token");
    expect(stored?.expiresAt).toBe(0);
  });

  it("falls back to an empty idToken only on a genuine cold start", async () => {
    await setRefreshToken(env, "new-refresh-token");

    const stored = await env.SPLASH_STANDINGS_KV.get<{ idToken: string }>(AUTH_KV_KEY, "json");
    expect(stored?.idToken).toBe("");
  });
});
