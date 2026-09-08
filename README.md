# Splash Sports Standings

> This is mostly vibe-coded so reference the `claude.md` file and make sure you review the code before deploying

Reads [Splash Sports](splashsports.com) data to create a custom user filter.
Their site doesn't let you create/filter by a subset of users like the old [officefootball](https://www.officefootballpool.com/) used to (Splash acquired this site).

Using one Cloudflare worker to handle everything:

- cron job to read the data
- server the api routes (`/api/*`)
- host the frontend (`public/`)

## Prerequisites

- Node.js and npm
- A Cloudflare account with Wrangler logged in (`npx wrangler login`)

## Local development

```bash
npm install
npm run dev          # wrangler dev
```

`wrangler dev` uses local-only bindings by default, so it won't have a real `SPLASH_REFRESH_TOKEN` or KV data unless you set up `.dev.vars` and/or run with `--remote` to use the real KV namespace and secrets:

```bash
npx wrangler dev --remote --test-scheduled
```

`--test-scheduled` exposes `GET /__scheduled` to manually trigger the cron handler (which does the actual Splash Sports fetch + refresh) without waiting for the schedule.

## Deploying

```bash
npm run deploy        # wrangler deploy
```

One-time setup on a fresh Cloudflare account/project:

```bash
npx wrangler kv namespace create SPLASH_STANDINGS_KV
# put the resulting id into wrangler.jsonc's kv_namespaces entry

npx wrangler secret put SPLASH_REFRESH_TOKEN
```

## Configuration

Edit [src/config.ts](src/config.ts):

- `CONTEST_ID`: the Splash Sports contest id (stable for the season).
- `FILTERED_HANDLES`: the exact Splash Sports handles to show. **Case-sensitive**

## Updating the refresh token

Splash Sports login is CAPTCHA-gated, so I couldn't automate this entirely. The Worker uses a **refresh token** to gather a new session tokens (via `api.auth.splashsports.com/universal-auth/refresh`), which works unattended for as long as that refresh token stays valid. I don't know how long that token lives, but when it expires, the data will go stale and a warning is displayed on the site.

Two ways to refresh:
**bookmark** Splash stores that same refresh token in a (non-HttpOnly) `refreshToken` cookie on `splashsports.com`, so a bookmarklet can read it

1. One-time setup: generate a random secret and store it as the Worker's `ADMIN_TOKEN` (prevents anyone from randomly hitting the endpoint):

   ```bash
   openssl rand -hex 32
   npx wrangler secret put ADMIN_TOKEN
   ```

2. Save this as a browser bookmark (edit the bookmark's URL field), replacing `ADMIN_TOKEN_VALUE` **and** `YOUR-SUBDOMAIN` with your actual values (your Worker's real URL isn't written here on purpose, so it doesn't end up in git, check `wrangler.jsonc`/your Cloudflare dashboard for it):

   ```js
   javascript:(function () { var match = document.cookie.match(/(?:^|; )refreshToken=([^;]+)/); if (!match) { alert("refreshToken cookie not found! Are you logged into Splash Sports?"); return; } var token = decodeURIComponent(match[1]); fetch("https://splash-sports-standings.YOUR-SUBDOMAIN.workers.dev/api/refresh-token", { method: "POST", headers: { Authorization: "Bearer ADMIN_TOKEN_VALUE", "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: token }) }).then(function (r) { return r.json(); }).then(function (d) { alert(d.ok ? "Refresh token updated! Site is live again." : "Failed: " + d.error); }).catch(function (e) { alert("Request failed: " + e); }); })();
   ```

3. Whenever the site shows the "DATA NOT LIVE" banner: open `https://contests.app.splashsports.com/` (make sure you're logged in),  click the bookmark and you'll get an alert saying whether it worked.

**Manual way**, if you'd rather not use the bookmark:

1. Log into Splash Sports in a browser (`https://contests.app.splashsports.com/`).
2. Read the `refreshToken` cookie: Devtools → Application → Cookies → `splashsports.com`).
3. Update the secret with it:

   ```bash
   npx wrangler secret put SPLASH_REFRESH_TOKEN
   ```

4. The next scheduled run (within 5 minutes) will pick it up. To confirm immediately instead of waiting, use the `wrangler dev --remote --test-scheduled` flow above, which reads/writes the real KV namespace and secrets.

   Note: this only takes effect on cold start / when KV's cached auth state is empty. The bookmarklet's endpoint writes straight to KV instead, which is why it's the more reliable option.

## Architecture

- `src/auth.ts`: refresh-token-based auth
- `src/splash.ts`: season leaderboard fetch/pagination + the CloudFront browser-header workaround required by `api.splashsports.com`.
- `src/picks.ts`: slates (weeks), per-entry weekly picks, game catalog, and the team-pick logic
- `src/index.ts`: the `scheduled()` cron handler (orchestrates the refresh and writes KV), `fetch()` handler (serves `/api/*` + static assets), and the `ADMIN_TOKEN` protected `POST /api/refresh-token` the bookmark calls.
- `public/`: plain HTML/JS/CSS frontend, no build step. Polls `/api/*` every 60 seconds.
