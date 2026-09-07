import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
        // Secrets aren't in wrangler.jsonc, so give tests fake values rather
        // than touching the real ones set via `wrangler secret put`.
        miniflare: {
          bindings: {
            SPLASH_REFRESH_TOKEN: "test-refresh-token",
            ADMIN_TOKEN: "test-admin-token",
          },
        },
      },
    },
  },
});
