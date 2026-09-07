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

// "winning"/"losing" are Splash's own live-tracking values for any
// in-progress game (confirmed on both a regular game and the tiebreaker
// game, not just the latter) — not a final grade. null means the game
// hasn't started or hasn't graded yet.
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
  picks: WeeklyPick[];
}

interface WeeklyLeaderboardEntry {
  metadata: { record: { wins: number; losses: number; ties: number | null } };
  picks: { data: WeeklyPick[] } | null;
}

interface WeeklyLeaderboardResponse {
  data: WeeklyLeaderboardEntry[];
}

// Returns null when the entry has no picks/results for this slate yet (e.g. a
// future week that hasn't started — the API returns an empty `data` array).
export async function fetchEntryWeek(
  idToken: string,
  contestId: string,
  slateId: string,
  entryId: string,
): Promise<WeeklyEntryResult | null> {
  const url = new URL(LEADERBOARD_URL);
  url.searchParams.set("contestId", contestId);
  url.searchParams.set("slateId", slateId);
  url.searchParams.set("picksSlateId", slateId);
  url.searchParams.set("entryId", entryId);

  const response = await fetch(url, { headers: splashHeaders(idToken) });
  if (!response.ok) {
    throw new Error(`Splash Sports weekly picks request failed: ${response.status}`);
  }

  const body = (await response.json()) as WeeklyLeaderboardResponse;
  const entry = body.data[0];
  if (!entry) {
    return null;
  }

  return {
    wins: entry.metadata.record.wins,
    losses: entry.metadata.record.losses,
    ties: entry.metadata.record.ties,
    picks: entry.picks?.data ?? [],
  };
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
  // Seen so far: "scheduled" (not started), "in_progress" (live),
  // "finished" and "finalized" (both terminal — Splash uses two different
  // strings for "done").
  status: string;
  // Only populated while status is "in_progress".
  state: GameState | null;
  home: GameTeam;
  away: GameTeam;
}

interface PicksheetResponse {
  data: {
    games: SlateGame[];
  };
}

// The no-entryId picksheets call returns the full game schedule/matchups for
// a slate (spreads, teams) — used as a lookup so the weekly picks matrix can
// show real matchups ("RUTG @ MASS") as column headers, not just whichever
// side each individual user happened to pick.
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

// How many of this week's required picks are still undecided — either not
// yet submitted, or submitted but the underlying game hasn't reached a final
// grade. Deliberately uses Splash's own wins/losses/ties count rather than
// inspecting individual pick grades ourselves: Splash has already surprised
// us twice with grade/status strings we hadn't seen before ("winning"/
// "losing" as a live, non-final grade; "finished" as a second terminal game
// status alongside "finalized"), so trusting their own decided-picks count
// is more robust than trying to keep our own classification exhaustive.
export function computePendingCount(week: WeeklyEntryResult, picksRequiredCount: number): number {
  const decided = week.wins + week.losses + (week.ties ?? 0);
  return picksRequiredCount - decided;
}

interface TeamPickStat {
  teamAlias: string;
  teamName: string;
  picks: number;
  wins: number;
  losses: number;
}

// Tallies, per team a user picked across every week we have data for, how
// often they picked that team and their win/loss record doing so.
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
