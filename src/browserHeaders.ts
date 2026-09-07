// Both api.splashsports.com and api.auth.splashsports.com sit behind a
// CloudFront/WAF setup that 403s requests missing browser-like headers
// (User-Agent, Origin, Referer, Sec-Fetch-*) — confirmed empirically against
// both hosts. Every outgoing Splash Sports request needs this base set.
export function browserLikeHeaders(): HeadersInit {
  return {
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:155.0) Gecko/20100101 Firefox/155.0",
    Referer: "https://contests.app.splashsports.com/",
    Origin: "https://contests.app.splashsports.com",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
  };
}
