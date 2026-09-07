import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("fetch routing", () => {
  it("404s an unknown route", async () => {
    const response = await SELF.fetch("https://example.com/api/nope");
    expect(response.status).toBe(404);
  });

  it("returns an empty default payload (with splashUrl) when standings haven't been cached yet", async () => {
    const response = await SELF.fetch("https://example.com/api/standings");
    const body = await response.json<{ lastUpdated: string | null; entries: unknown[]; splashUrl: string }>();

    expect(response.status).toBe(200);
    expect(body.entries).toEqual([]);
    expect(body.splashUrl).toContain("contests.app.splashsports.com");
  });

  it("defaults /api/status to ok when no refresh has run yet", async () => {
    const response = await SELF.fetch("https://example.com/api/status");
    const body = await response.json<{ ok: boolean }>();

    expect(body.ok).toBe(true);
  });
});

describe("POST /api/refresh-token auth", () => {
  it("rejects a request with no Authorization header", async () => {
    const response = await SELF.fetch("https://example.com/api/refresh-token", {
      method: "POST",
      body: JSON.stringify({ refreshToken: "x" }),
    });

    expect(response.status).toBe(401);
  });

  it("rejects a request with the wrong bearer token", async () => {
    const response = await SELF.fetch("https://example.com/api/refresh-token", {
      method: "POST",
      headers: { Authorization: "Bearer wrong-token" },
      body: JSON.stringify({ refreshToken: "x" }),
    });

    expect(response.status).toBe(401);
  });

  // The test env's ADMIN_TOKEN is set in vitest.config.ts, not the real secret.
  it("accepts the correct bearer token but rejects a missing refreshToken body", async () => {
    const response = await SELF.fetch("https://example.com/api/refresh-token", {
      method: "POST",
      headers: { Authorization: "Bearer test-admin-token", "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const body = await response.json<{ ok: boolean; error: string }>();

    expect(response.status).toBe(400);
    expect(body.error).toBe("missing refreshToken");
  });

  it("rejects non-POST/OPTIONS methods", async () => {
    const response = await SELF.fetch("https://example.com/api/refresh-token", { method: "GET" });
    expect(response.status).toBe(405);
  });
});

describe("CORS on /api/refresh-token", () => {
  it("allows an OPTIONS preflight from an allowed Splash Sports origin", async () => {
    const response = await SELF.fetch("https://example.com/api/refresh-token", {
      method: "OPTIONS",
      headers: { Origin: "https://contests.app.splashsports.com" },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://contests.app.splashsports.com");
  });

  it("omits CORS headers for a disallowed origin", async () => {
    const response = await SELF.fetch("https://example.com/api/refresh-token", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example.com" },
    });

    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
