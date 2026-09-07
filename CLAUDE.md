# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single Cloudflare Worker that scrapes a Splash Sports college pick-em contest and displays standings/picks filtered down to a specific group of participants (Splash has no filtering feature of its own). No frontend framework, no build step — `public/` is plain HTML/JS/CSS served directly by the Worker's static assets binding.

## Commands

```bash
npm install
npm run dev                                    # wrangler dev (local-only bindings)
npx wrangler dev --remote --test-scheduled      # real KV/secrets + GET /__scheduled to trigger cron on demand
npm run deploy                                  # wrangler deploy
npm run test                                    # vitest run
npm run types                                   # regenerate worker-configuration.d.ts after touching wrangler.jsonc
npm run tail                                    # wrangler tail
```

Single test file: `npx vitest run test/picks.test.ts`. Single test case: add `.only` to the `it(...)`/`describe(...)` call.

## Architecture

**One Worker does everything**: `src/index.ts`'s `scheduled()` (cron — see `wrangler.jsonc`'s `triggers.crons` for the current interval, it's changed before) fetches fresh data from Splash and writes it to KV; `fetch()` serves `/api/*` from that KV cache plus the static frontend. The frontend never talks to Splash Sports directly — it only ever calls this Worker's own `/api/*`.

**KV is the source of truth for cached data** (single namespace, `SPLASH_STANDINGS_KV`): keys `standings`, `weekly_cache`, `aggregates`, `status`, and `auth` (see below). All are plain JSON blobs, not per-item keys.

### Auth (`src/auth.ts`) — read this before touching anything auth-related

Splash's real login (`api.auth.splashsports.com/universal-auth/login`) is gated by a Google reCAPTCHA token — **this can't be automated**, and nothing in this repo should try to. What *can* be automated is refreshing an already-issued session via `POST api.auth.splashsports.com/universal-auth/refresh`, body `{refreshToken, accessToken}` (the current/possibly-expired ID token), response `{accessToken, expiresIn}` (the `expiresIn` value is unreliable — decode the JWT's own `exp` claim instead, which is what `decodeJwtExpiryMs` does). This is **not raw Cognito**, despite the ID token's `iss`/`aud` claims pointing at a Cognito user pool — raw `InitiateAuth` calls were tried first and fail with `NotAuthorizedException: ... configured with secret but SECRET_HASH was not received` (the app client needs a secret we don't have).

Two load-bearing, non-obvious facts learned by testing against the real API, not from any docs:
- **The refresh endpoint rejects an empty `accessToken`** with `400 accessToken should not be empty`, but **accepts one that's real but hours expired**. This is why `setRefreshToken()` preserves whatever ID token is already cached instead of clearing it — clearing it caused a real production outage (clicking the refresh-token bookmarklet wiped the cached ID token, and the resulting refresh call then failed on the now-empty `accessToken`, a chicken-and-egg failure). A true cold start (KV never populated at all) has no fallback and must be seeded once with a real captured ID token via `wrangler kv key put`.
- **`api.splashsports.com` and `api.auth.splashsports.com` both sit behind a CloudFront/WAF** that 403s (a plain CloudFront HTML error page, not a JSON API error) any request missing browser-like headers — `User-Agent`, `Origin`, `Referer`, `Sec-Fetch-*`. `src/browserHeaders.ts`'s `browserLikeHeaders()` supplies these; any *new* call to either host needs it too, or it will silently 403.

The refresh token itself has an unknown lifetime and must be captured manually from a browser (see README's "Updating the refresh token" — there's a bookmarklet for this that reads the non-HttpOnly `refreshToken` cookie on `splashsports.com` and POSTs it to this Worker's own `ADMIN_TOKEN`-gated `POST /api/refresh-token`, which updates KV and immediately re-runs the refresh for instant feedback).

### Data model (`src/picks.ts`, orchestrated in `src/index.ts`)

Splash's `team_pick_em` contest: each week (a "slate") requires picking a subset of games (`picksRequiredCount`, e.g. 20 of ~43 available). Key endpoints, all needing the CloudFront headers above:
- `leaderboards?contestId=X&limit=150` — season standings (in practice the whole ~126-entry contest fits one page; `nextCursor` pagination is still implemented defensively).
- `contests/slates?contestId=X` — the list of weeks, each with `status` (`scheduled`/`in_progress`/other), `isCurrentSlate`, `settledDate`.
- `leaderboards?contestId=X&slateId=Y&picksSlateId=Y&entryId=Z` — one entry's picks for week Y, each pick carrying `team`, `spread`, `grade`, `effectivePoints`. `grade` has **five** observed values, not three: `"won"`/`"lost"`/`"push"` (final) and `"winning"`/`"losing"` — Splash's own live read on any in-progress game's pick, not something specific to the tiebreaker game (confirmed on a regular game too, despite an earlier wrong assumption here). `null` means not yet started/graded.
- `team-pickem/picksheets?contestId=X&slateId=Y` (no `entryId`) — the week's full game catalog (matchups, spreads, live/final scores, and — while a game is `in_progress` — `state: {quarter, clock}`, e.g. `{quarter: 1, clock: "14:38"}`) independent of any one user's picks. Used for column headers/context in the weekly view. Games use **two different terminal status strings**, `"finalized"` and `"finished"` — treat both as done; `lib.js`'s `FINISHED_STATUSES` set exists for exactly this.

`refreshWeeklyCache()` in `index.ts` **only fetches slates that have started** (`status !== "scheduled"`, or `isCurrentSlate`) and, once a slate's `settledDate` is set, caches it as `final` and never refetches it — without this the Worker would re-fetch pick data for every one of ~20 weeks × 6 filtered users on every cron tick for the entire season.

`pending` (shown on the Overall tab) and the weekly `Score`/`Pending` columns all come from this same weekly data — no separate fetch. **`computePendingCount` deliberately uses `week.wins + week.losses + week.ties` (Splash's own decided-picks count) rather than counting pick grades itself** — an earlier version filtered `picks` for "final" grades and undercounted pending by one per user once "winning"/"losing" showed up, since that grade isn't null but also isn't final. Splash's own win/loss/tie totals are correct by construction regardless of what grade strings exist, including ones not discovered yet — this is the second time an unanticipated Splash value (`"finished"` was the first) broke code that tried to enumerate all possible values instead of trusting Splash's own aggregate. Don't reintroduce pick-grade counting here.

### Config (`src/config.ts`)

`CONTEST_ID` and `FILTERED_HANDLES` are the only things a new season/pool needs to change. Splash handles are **case-sensitive** (e.g. `THE_LEDGE`, not `The_Ledge` — this bit us once; verify against the real leaderboard data rather than guessing).

### Frontend (`public/`)

No build step, no framework — but it *is* an ES module (`index.html` loads `app.js` via `<script type="module">`), specifically so `app.js` can `import` from **`public/lib.js`**. `lib.js` holds every pure, DOM-free function (`recordText`, `winPct`, `withGroupRank`, `computeWeeklyPending`, `isLiveGame`/`FINISHED_STATUSES`, `gameHeaderLines`, `pickCellClass`, `sortGameIds`) specifically so they're unit-testable — see `test/lib.test.ts`, which imports `lib.js` directly (works because `tsconfig.json` has `allowJs: true` and explicitly includes `public/lib.js`, but *not* `app.js`/`index.html` — those touch `document`/`localStorage`, which aren't in this project's `lib` (`es2022` only, no `dom`), so pulling them into the TS program would need bigger changes). If you add new pure logic to `app.js`, put it in `lib.js` instead and test it — that's the whole reason the split exists.

`app.js` itself just does DOM rendering and polls `/api/standings`, `/api/weekly`, `/api/aggregates`, `/api/status` every 60s. Notable non-obvious bits:
- The weekly picks table only shows games at least one *filtered* user actually picked (not the full ~43-game slate), with live games sorted first (`sortGameIds` in `lib.js`).
- `computeWeeklyPending` in `lib.js` **must** stay in sync with `computePendingCount` in `src/picks.ts` — same wins/losses/ties logic, intentionally duplicated because the frontend and Worker are separate runtimes with no shared module boundary. An earlier version of the frontend copy used the old (wrong) pick-grade-counting approach after the backend had already been fixed — check both when touching either.
- Live (ungraded) picks are colored by whether they're *currently covering the spread* (score margin + spread, mirroring how the final `grade` works), not a preview of Splash's own eventual grade.
- `#standings th`/`td` get their own tighter padding rule so the 7-column Overall table fits without horizontal scroll even on a 375px viewport — don't add columns there without rechecking that.

### Repo hygiene

`.claude/` is gitignored — its `settings.json` accumulates tool-permission allowlist entries that end up containing real command output (e.g. the actual Worker subdomain), which is deliberately kept out of version control. Same reasoning applies to any docs: don't hardcode the real `*.workers.dev` subdomain in README/CLAUDE.md — use a placeholder.

## Testing

`@cloudflare/vitest-pool-workers` is pinned to `0.9.10` (with `vitest@^3.2.x`) rather than the current latest (`0.22.0`, which requires `vitest@^4` and dropped the documented `defineWorkersConfig` config API for something undocumented at the time this was set up). `npm audit` will flag high-severity CVEs in that older version's bundled `miniflare`/`undici`/`ws` — these are transitive dev-only test-tooling dependencies that never ship in the deployed Worker (`wrangler deploy` only bundles `src/*.ts`), so this was a deliberate tradeoff, not an oversight.

Tests live in `test/` (not colocated with `src/`) and import from `../src/*` or `../public/lib.js`. They exercise pure logic directly (`picks.test.ts`, `splash.test.ts`, `auth.test.ts`, `lib.test.ts`) and the actual `fetch()` handler via `SELF.fetch(...)` from `cloudflare:test` (`index.test.ts`) against Miniflare's local, isolated KV — never the real remote namespace.

Still **not** tested, as of this writing: the success path of `POST /api/refresh-token` and every function in `src/*.ts` that actually calls the real Splash API (`fetchSlates`, `fetchEntryWeek`, `fetchGameCatalog`, `fetchFullLeaderboard`, `getValidIdToken`) or `src/index.ts`'s orchestration functions (`refreshAll`, `refreshWeeklyCache`'s final-slate caching logic, `computeAggregatesCache`) — none of these are exported, and testing them for real needs either live credentials/network or a fetch-mocking setup that doesn't exist yet. If you add one, mock `fetch` rather than hitting Splash's real API from a test.
