// Secrets set via `wrangler secret put` / `.dev.vars` aren't declared in
// wrangler.jsonc, so `wrangler types` doesn't know about them. Declared here
// via declaration merging into the generated global `Env` interface.
//
// SPLASH_REFRESH_TOKEN: the refresh token from Splash Sports' own auth
// gateway (api.auth.splashsports.com/universal-auth/refresh), obtained by
// manually logging into Splash Sports in a browser (login is CAPTCHA-gated,
// so this can't be automated) and capturing it from the refresh request body.
// Its lifetime is unknown; when it eventually stops working, this secret
// needs to be replaced with a freshly captured one.
interface Env {
  SPLASH_REFRESH_TOKEN: string;
  // Bearer secret guarding POST /api/refresh-token — lets a one-click browser
  // bookmarklet update SPLASH_REFRESH_TOKEN's live value without ever needing
  // Cloudflare API credentials. See README's "Updating the refresh token".
  ADMIN_TOKEN: string;
}
