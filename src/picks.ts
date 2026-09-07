import { splashHeaders } from "./splash";

const SLATES_URL = "https://api.splashsports.com/contests-service-v2/api/contests/slates";
const LEADERBOARD_URL = "https://api.splashsports.com/contests-service-v2/api/leaderboards";
const PICKSHEETS_URL = "https://api.splashsports.com/contests-service-v2/api/team-pickem/picksheets";

interface Slate {
  id: string;
  name: string;
  status: string;
  isCurrentSlate: boolean;
  pickLockDate: string;
  settledDate: string | null;
  picksRequiredCount: number;
}

interface SlatesResponse {
  data: Slate[];
}

export async function fetchSlates(idToken: string, contestId: string): Promise<Slate[]> {
  const url = new URL(SLATES_URL);
  url.searchParams.set("contestId", contestId);
  url.searchParams.set("limit", "50");
  url.searchParams.set("offset", "0");

  const response = await fetch(url, { headers: splashHeaders(idToken) });
  if (!response.ok) {
    throw new Error(`Splash Sports slates request failed: ${response.status}`);
  }

  return ((await response.json()) as SlatesResponse).data;
}

// "winning"/"losing" are Splash's own values for any in-progress game, 
// not a final grade. null means the game hasn't started or hasn't graded yet.
type PickGrade = "won" | "lost" | "push" | "winning" | "losing" | null;

export interface WeeklyPick {
  gameId: string;
  team: { alias: string; name: string };
  spread: number;
  grade: PickGrade;
  effectivePoints: number;
}

export interface WeeklyEntryResult {
  wins: number;
  losses: number;
  ties: number | null;
  // Splash's own precomputed max reachable score
  potentialPoints: number;
  picks: WeeklyPick[];
}

interface WeeklyLeaderboardEntry {
  user: { handle: string };
  metadata: { record: { wins: number; losses: number; ties: number | null } };
  metrics: Array<{ type: string; value: number }>;
  picks: { data: WeeklyPick[] } | null;
}

interface WeeklyLeaderboardResponse {
  data: WeeklyLeaderboardEntry[];
  nextCursor: string | null;
}

const WEEKLY_PAGE_LIMIT = 150;
const WEEKLY_MAX_PAGES = 50;

export async function fetchSlateWeeks(
  idToken: string,
  contestId: string,
  slateId: string,
): Promise<Map<string, WeeklyEntryResult>> {
  const byHandle = new Map<string, WeeklyEntryResult>();
  let cursor: string | null = null;

  for (let page = 0; page < WEEKLY_MAX_PAGES; page++) {
    const url = new URL(LEADERBOARD_URL);
    url.searchParams.set("contestId", contestId);
    url.searchParams.set("slateId", slateId);
    url.searchParams.set("picksSlateId", slateId);
    url.searchParams.set("limit", String(WEEKLY_PAGE_LIMIT));
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const response = await fetch(url, { headers: splashHeaders(idToken) });
    if (!response.ok) {
      throw new Error(`Splash Sports weekly picks request failed: ${response.status}`);
    }

    const body = (await response.json()) as WeeklyLeaderboardResponse;
    for (const entry of body.data) {
      const wins = entry.metadata.record.wins;
      const potentialPoints = entry.metrics.find((metric) => metric.type === "potential_points")?.value ?? wins;

      byHandle.set(entry.user.handle, {
        wins,
        losses: entry.metadata.record.losses,
        ties: entry.metadata.record.ties,
        potentialPoints,
        picks: entry.picks?.data ?? [],
      });
    }

    if (!body.nextCursor) {
      break;
    }
    cursor = body.nextCursor;
  }

  return byHandle;
}

interface GameTeam {
  alias: string;
  name: string;
  spread: number;
  score: number | null;
}

interface GameState {
  quarter: number;
  clock: string;
}

export interface SlateGame {
  gameId: string;
  startsAt: string;
  status: string;   // "scheduled" (not started), "in_progress" (live), "finished" and "finalized"
  state: GameState | null;    // Only populated while status is "in_progress".
  home: GameTeam;
  away: GameTeam;
}

interface PicksheetResponse {
  data: {
    games: SlateGame[];
  };
}

// The no-entryId picksheets call returns the full game schedule/matchups
// used as a lookup so the weekly picks matrix can show real matchups
export async function fetchGameCatalog(
  idToken: string,
  contestId: string,
  slateId: string,
): Promise<SlateGame[]> {
  const url = new URL(PICKSHEETS_URL);
  url.searchParams.set("contestId", contestId);
  url.searchParams.set("slateId", slateId);

  const response = await fetch(url, { headers: splashHeaders(idToken) });
  if (!response.ok) {
    throw new Error(`Splash Sports picksheets request failed: ${response.status}`);
  }

  const body = (await response.json()) as PicksheetResponse;
  return body.data.games.map((game) => ({
    gameId: game.gameId,
    startsAt: game.startsAt,
    status: game.status,
    state: game.state,
    home: game.home,
    away: game.away,
  }));
}

// How many of this week's required picks are still undecided
export function computePendingCount(week: WeeklyEntryResult): number {
  return week.potentialPoints - week.wins;
}

interface TeamPickStat {
  teamAlias: string;
  teamName: string;
  picks: number;
  wins: number;
  losses: number;
}

// Count per team a user picked across every week we have data for
// how often they picked that team and their win/loss record doing so.
export function computeTeamAggregates(weeks: WeeklyEntryResult[]): TeamPickStat[] {
  const byTeam = new Map<string, TeamPickStat>();

  for (const week of weeks) {
    for (const pick of week.picks) {
      const stat = byTeam.get(pick.team.alias) ?? {
        teamAlias: pick.team.alias,
        teamName: pick.team.name,
        picks: 0,
        wins: 0,
        losses: 0,
      };
      stat.picks += 1;
      if (pick.grade === "won") stat.wins += 1;
      if (pick.grade === "lost") stat.losses += 1;
      byTeam.set(pick.team.alias, stat);
    }
  }

  return [...byTeam.values()].sort((a, b) => b.picks - a.picks || a.teamName.localeCompare(b.teamName));
}

export interface PoolPickCount {
  gameId: string;
  team: { alias: string; name: string };
  count: number;
}

// Counts how many of the WHOLE contest's entries (not just our filtered
// subset) picked each team, per game, for one slate 
// Only counts, not win/loss, to keep the cache small.
export function computePoolPickCounts(weekByHandle: Map<string, WeeklyEntryResult>): PoolPickCount[] {
  const counts = new Map<string, PoolPickCount>();

  for (const week of weekByHandle.values()) {
    for (const pick of week.picks) {
      const key = `${pick.gameId}:${pick.team.alias}`;
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { gameId: pick.gameId, team: { alias: pick.team.alias, name: pick.team.name }, count: 1 });
      }
    }
  }

  return [...counts.values()];
}
