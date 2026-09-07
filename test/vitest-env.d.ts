// Ambient types for the "cloudflare:test" module (SELF, env, etc.) used in
// *.test.ts files. A `types="@cloudflare/vitest-pool-workers/types"` triple-
// slash reference doesn't resolve under our tsconfig's moduleResolution, so
// this points at the file directly.
/// <reference path="../node_modules/@cloudflare/vitest-pool-workers/types/cloudflare-test.d.ts" />

declare module "cloudflare:test" {
  // Gives the `env` import in *.test.ts files our actual binding types.
  interface ProvidedEnv extends Env {}
}
