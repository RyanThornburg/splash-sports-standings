import { CONTEST_ID, FILTERED_HANDLES, SPLASH_STANDINGS_URL } from "./config";
import { getValidIdToken, setRefreshToken } from "./auth";
import { fetchFullLeaderboard, toStandingsEntry, type StandingsEntry } from "./splash";
import {
  computePendingCount,
  computeTeamAggregates,
  fetchEntryWeek,
  fetchGameCatalog,
  fetchSlates,
  type SlateGame,
  type WeeklyEntryResult,
} from "./picks";

const STANDINGS_KV_KEY = "standings";
const WEEKLY_CACHE_KV_KEY = "weekly_cache";
const STATUS_KV_KEY = "status";

interface RefreshStatus {
  ok: boolean;
  checkedAt: string | null;
  error: string | null;
}

interface CachedStandings {
  lastUpdated: string;
  entries: StandingsEntry[];
  splashUrl: string;
}

interface CachedSlate {
  id: string;
  name: string;
  status: string;
  isCurrentSlate: boolean;
  pickLockDate: string;
  picksRequiredCount: number;
  games: SlateGame[];
  // Once a slate is settled its results can't change, so it's fetched once
  // and never refetched — keeps us from hammering Splash's API every 15 min
  // for weeks that are long over.
  final: boolean;
  users: Record<string, WeeklyEntryResult>;
}

interface WeeklyCache {
  lastUpdated: string;
  slates: CachedSlate[];
}

async function fetchSeasonStandings(idToken: string): Promise<StandingsEntry[]> {
  const allEntries = await fetchFullLeaderboard(idToken, CONTEST_ID);
  return allEntries
    .filter((entry) => FILTERED_HANDLES.includes(entry.user.handle))
    .map(toStandingsEntry)
    .sort((a, b) => a.rank - b.rank);
}

async function refreshWeeklyCache(
  env: Env,
  idToken: string,
  seasonEntries: StandingsEntry[],
): Promise<WeeklyCache> {
  const existing = await env.SPLASH_STANDINGS_KV.get<WeeklyCache>(WEEKLY_CACHE_KV_KEY, "json");
  const existingById = new Map(existing?.slates.map((s) => [s.id, s]) ?? []);

  const slates = await fetchSlates(idToken, CONTEST_ID);
  const updatedSlates: CachedSlate[] = [];

  for (const slate of slates) {
    if (slate.status === "scheduled" && !slate.isCurrentSlate) {
      // Hasn't started — Splash has no picks/results data for it yet.
      continue;
    }

    const cached = existingById.get(slate.id);
    if (cached?.final) {
      updatedSlates.push(cached);
      continue;
    }

    const games = await fetchGameCatalog(idToken, CONTEST_ID, slate.id);

    const users: Record<string, WeeklyEntryResult> = {};
    for (const entry of seasonEntries) {
      const week = await fetchEntryWeek(idToken, CONTEST_ID, slate.id, entry.entryId);
      if (week) {
        users[entry.handle] = week;
      }
    }

    updatedSlates.push({
      id: slate.id,
      name: slate.name,
      status: slate.status,
      isCurrentSlate: slate.isCurrentSlate,
      pickLockDate: slate.pickLockDate,
      picksRequiredCount: slate.picksRequiredCount,
      games,
      final: slate.settledDate !== null,
      users,
    });
  }

  return { lastUpdated: new Date().toISOString(), slates: updatedSlates };
}

interface AggregatesCache {
  lastUpdated: string;
  byHandle: Record<string, ReturnType<typeof computeTeamAggregates>>;
}

function computeAggregatesCache(weekly: WeeklyCache, handles: string[]): AggregatesCache {
  const byHandle: AggregatesCache["byHandle"] = {};

  for (const handle of handles) {
    const weeks = weekly.slates
      .map((slate) => slate.users[handle])
      .filter((week): week is WeeklyEntryResult => week !== undefined);
    byHandle[handle] = computeTeamAggregates(weeks);
  }

  return { lastUpdated: new Date().toISOString(), byHandle };
}

// Attaches each entry's pending-picks count for the current week, using the
// weekly cache we just built (rather than a separate fetch).
function applyPendingCounts(entries: StandingsEntry[], weekly: WeeklyCache): void {
  const currentSlate = weekly.slates.find((slate) => slate.isCurrentSlate);
  if (!currentSlate) return;

  for (const entry of entries) {
    const week = currentSlate.users[entry.handle];
    entry.pending = week ? computePendingCount(week, currentSlate.picksRequiredCount) : null;
  }
}

async function refreshAll(env: Env): Promise<void> {
  const idToken = await getValidIdToken(env);

  const seasonEntries = await fetchSeasonStandings(idToken);
  const weekly = await refreshWeeklyCache(env, idToken, seasonEntries);
  applyPendingCounts(seasonEntries, weekly);

  await env.SPLASH_STANDINGS_KV.put(
    STANDINGS_KV_KEY,
    JSON.stringify({
      lastUpdated: new Date().toISOString(),
      entries: seasonEntries,
      splashUrl: SPLASH_STANDINGS_URL,
    } satisfies CachedStandings),
  );
  await env.SPLASH_STANDINGS_KV.put(WEEKLY_CACHE_KV_KEY, JSON.stringify(weekly));

  const aggregates = computeAggregatesCache(weekly, FILTERED_HANDLES);
  await env.SPLASH_STANDINGS_KV.put("aggregates", JSON.stringify(aggregates));
}

async function markStatus(env: Env, ok: boolean, error: string | null): Promise<void> {
  const status: RefreshStatus = { ok, checkedAt: new Date().toISOString(), error };
  await env.SPLASH_STANDINGS_KV.put(STATUS_KV_KEY, JSON.stringify(status));
}

// Origins the refresh-token bookmarklet can run from (it executes in the
// Splash Sports tab, so this is a CORS allowlist, not an auth check — the
// ADMIN_TOKEN bearer check is the actual gate).
const ADMIN_ALLOWED_ORIGINS = [
  "https://contests.app.splashsports.com",
  "https://app.splashsports.com",
  "https://www.splashsports.com",
  "https://splashsports.com",
];

function adminCorsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("Origin");
  if (!origin || !ADMIN_ALLOWED_ORIGINS.includes(origin)) {
    return {};
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}

async function sha256(text: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return new Uint8Array(digest);
}

// Cloudflare's docs advertise a non-standard crypto.timingSafeEqual, but it
// isn't actually present at runtime (confirmed empirically — throws
// "crypto.timingSafeEqual is not a function"). Comparing fixed-length SHA-256
// digests byte-by-byte with a constant-time OR accumulator avoids depending
// on it, and avoids leaking the real token's length via early-exit comparison.
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

async function isValidAdminToken(request: Request, env: Env): Promise<boolean> {
  const provided = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!provided) return false;
  const [a, b] = await Promise.all([sha256(provided), sha256(env.ADMIN_TOKEN)]);
  return constantTimeEqual(a, b);
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/standings") {
      const cached = await env.SPLASH_STANDINGS_KV.get<CachedStandings>(STANDINGS_KV_KEY, "json");
      return Response.json(cached ?? { lastUpdated: null, entries: [], splashUrl: SPLASH_STANDINGS_URL });
    }

    if (url.pathname === "/api/weekly") {
      const cached = await env.SPLASH_STANDINGS_KV.get<WeeklyCache>(WEEKLY_CACHE_KV_KEY, "json");
      return Response.json(cached ?? { lastUpdated: null, slates: [] });
    }

    if (url.pathname === "/api/aggregates") {
      const cached = await env.SPLASH_STANDINGS_KV.get<AggregatesCache>("aggregates", "json");
      return Response.json(cached ?? { lastUpdated: null, byHandle: {} });
    }

    if (url.pathname === "/api/status") {
      const cached = await env.SPLASH_STANDINGS_KV.get<RefreshStatus>(STATUS_KV_KEY, "json");
      return Response.json(cached ?? ({ ok: true, checkedAt: null, error: null } satisfies RefreshStatus));
    }

    if (url.pathname === "/api/refresh-token") {
      const cors = adminCorsHeaders(request);

      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: cors });
      }

      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405, headers: cors });
      }

      if (!(await isValidAdminToken(request, env))) {
        return Response.json({ ok: false, error: "unauthorized" }, { status: 401, headers: cors });
      }

      const body = await request.json<{ refreshToken?: string }>().catch(() => null);
      if (!body?.refreshToken) {
        return Response.json({ ok: false, error: "missing refreshToken" }, { status: 400, headers: cors });
      }

      await setRefreshToken(env, body.refreshToken);

      try {
        await refreshAll(env);
        await markStatus(env, true, null);
        return Response.json({ ok: true }, { headers: cors });
      } catch (err) {
        await markStatus(env, false, String(err));
        return Response.json({ ok: false, error: String(err) }, { status: 502, headers: cors });
      }
    }

    return new Response("Not found", { status: 404 });
  },

  async scheduled(_controller, env, ctx): Promise<void> {
    ctx.waitUntil(
      refreshAll(env)
        .then(() => markStatus(env, true, null))
        .catch((err) => {
          console.error("Scheduled refresh failed", err);
          return markStatus(env, false, String(err));
        }),
    );
  },
} satisfies ExportedHandler<Env>;
