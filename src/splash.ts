import { browserLikeHeaders } from "./browserHeaders";

const LEADERBOARD_URL = "https://api.splashsports.com/contests-service-v2/api/leaderboards";
const PAGE_LIMIT = 150;
const MAX_PAGES = 50;

// splash-accept-version/x-app-platform mirror what the real web app sends.
export function splashHeaders(idToken: string): HeadersInit {
  return {
    ...browserLikeHeaders(),
    Authorization: `Bearer ${idToken}`,
    Accept: "application/json",
    "splash-accept-version": "3",
    "x-app-platform": "web-v2",
    "x-app-version": "0.0.0",
  };
}

export interface SplashLeaderboardEntry {
  rank: number;
  displayRank: string;
  score: number;
  user: {
    handle: string;
  };
  entry: {
    id: string;
    displayName: string | null;
  };
  metadata: {
    record: {
      wins: number;
      losses: number;
      ties: number | null;
    };
  };
  tiebreaker: {
    steps: Array<{ value: string; total: number | null; submitted?: number | null }>;
  };
}

interface SplashLeaderboardResponse {
  data: SplashLeaderboardEntry[];
  nextCursor: string | null;
}

export interface StandingsEntry {
  rank: number;
  displayRank: string;
  entryId: string;
  handle: string;
  displayName: string | null;
  score: number;
  wins: number;
  losses: number;
  ties: number | null;
  // Guess-the-score tiebreaker (e.g. LOU vs MISS), as |actual - guessed|.
  // null until that game has been played and both values are known.
  tiebreakerDiff: number | null;
  // Filled in later, from the current week's picks — null until then.
  pending: number | null;
}

async function fetchLeaderboardPage(
  idToken: string,
  contestId: string,
  cursor: string | null,
): Promise<SplashLeaderboardResponse> {
  const url = new URL(LEADERBOARD_URL);
  url.searchParams.set("contestId", contestId);
  url.searchParams.set("limit", String(PAGE_LIMIT));
  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }

  const response = await fetch(url, { headers: splashHeaders(idToken) });

  if (!response.ok) {
    throw new Error(`Splash Sports leaderboard request failed: ${response.status}`);
  }

  return (await response.json()) as SplashLeaderboardResponse;
}

export async function fetchFullLeaderboard(
  idToken: string,
  contestId: string,
): Promise<SplashLeaderboardEntry[]> {
  const entries: SplashLeaderboardEntry[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await fetchLeaderboardPage(idToken, contestId, cursor);
    entries.push(...response.data);

    if (!response.nextCursor) {
      break;
    }
    cursor = response.nextCursor;
  }

  return entries;
}

export function toStandingsEntry(entry: SplashLeaderboardEntry): StandingsEntry {
  const tiebreakerStep = entry.tiebreaker.steps.find((step) => step.value === "last_game_total");
  const tiebreakerDiff =
    tiebreakerStep?.total != null && tiebreakerStep?.submitted != null
      ? Math.abs(tiebreakerStep.total - tiebreakerStep.submitted)
      : null;

  return {
    rank: entry.rank,
    displayRank: entry.displayRank,
    entryId: entry.entry.id,
    handle: entry.user.handle,
    displayName: entry.entry.displayName,
    score: entry.score,
    wins: entry.metadata.record.wins,
    losses: entry.metadata.record.losses,
    ties: entry.metadata.record.ties,
    tiebreakerDiff,
    pending: null,
  };
}
