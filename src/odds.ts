// Market lines for the Lines tab, from ESPN's public college football
// scoreboard (no key). Each event carries one book's spread and total
// (DraftKings in practice), with both the opening and current number.
//
// Non-obvious bits, found by testing against the real endpoint:
// - `dates=YYYYMMDD-YYYYMMDD` ranges 400 ("Failed to get events endpoint")
//   for college football, so we ask one ET calendar day at a time.
// - `groups=80` is FBS; any game with an FBS team is included.
// - `pointSpread.home.close.line` is the *current* line until kickoff
//   ("close" doesn't mean the game is over). Strings look like "-3.5",
//   "+3", "o52.5"/"u52.5"; pick'em can show as "PK"/"EVEN".
// - ESPN drops a game's odds around kickoff, so callers keep the last line
//   they saw rather than overwrite it with nothing.
import type { SlateGame } from "./picks";

const ESPN_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard";

export interface MarketLine {
  provider: string;
  // Spreads are from the *Splash* home team's side (negative = Splash's
  // home team favoured), already flipped if ESPN lists the game the other
  // way round (neutral sites).
  spreadOpen: number | null;
  spread: number | null;
  totalOpen: number | null;
  total: number | null;
}

interface EspnTeam {
  abbreviation: string;
  location: string;
  shortDisplayName: string;
}

export interface EspnGame {
  id: string;
  startsAt: string;
  home: EspnTeam;
  away: EspnTeam;
  // From ESPN's home side.
  line: MarketLine | null;
}

interface RawLine {
  line?: string;
}

interface RawOdds {
  provider?: { name?: string };
  spread?: number;
  overUnder?: number;
  pointSpread?: { home?: { open?: RawLine; close?: RawLine } };
  total?: { over?: { open?: RawLine; close?: RawLine } };
}

interface RawCompetitor {
  homeAway: "home" | "away";
  team: EspnTeam;
}

interface RawEvent {
  id: string;
  date: string;
  competitions: { competitors: RawCompetitor[]; odds?: RawOdds[] }[];
}

// ESPN's provider string isn't stable: the same feed said "Draft Kings" on
// one refresh and "DraftKings" five minutes later (2026-11-13). Normalize the
// books we know so the frontend's labels and column heads stay put. Keep in
// sync with BOOKS in public/lib.js (separate runtimes, no shared module).
const BOOK_NAMES: Record<string, string> = {
  draftkings: "DraftKings",
  fanduel: "FanDuel",
  espnbet: "ESPN BET",
  betmgm: "BetMGM",
  caesars: "Caesars",
};

export function normalizeProvider(name: string | undefined | null): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "Market";
  return BOOK_NAMES[trimmed.toLowerCase().replace(/[^a-z0-9]/g, "")] ?? trimmed;
}

export function parseLine(text: string | undefined | null): number | null {
  if (text == null) return null;
  const t = text.trim().toUpperCase();
  if (t === "PK" || t === "EVEN" || t === "PICK") return 0;
  const n = Number(t.replace(/^[OU]/, ""));
  return Number.isFinite(n) ? n : null;
}

function toLine(odds: RawOdds | undefined): MarketLine | null {
  if (!odds) return null;
  const spread = parseLine(odds.pointSpread?.home?.close?.line) ?? odds.spread ?? null;
  const total = parseLine(odds.total?.over?.close?.line) ?? odds.overUnder ?? null;
  if (spread == null && total == null) return null;
  return {
    provider: normalizeProvider(odds.provider?.name),
    spreadOpen: parseLine(odds.pointSpread?.home?.open?.line),
    spread,
    totalOpen: parseLine(odds.total?.over?.open?.line),
    total,
  };
}

// Takes the raw JSON body; RawEvent above is just the part of it we read.
export function parseEspnScoreboard(body: unknown): EspnGame[] {
  const games: EspnGame[] = [];
  for (const event of (body as { events?: RawEvent[] })?.events ?? []) {
    const comp = event.competitions?.[0];
    const home = comp?.competitors.find((c) => c.homeAway === "home")?.team;
    const away = comp?.competitors.find((c) => c.homeAway === "away")?.team;
    if (!home || !away) continue;
    games.push({ id: event.id, startsAt: event.date, home, away, line: toLine(comp.odds?.[0]) });
  }
  return games;
}

const etDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// ESPN's `dates` are Eastern calendar days. Only days with a game still to
// kick off are worth asking about: started games keep their cached line.
export function espnDateKeys(startsAts: string[], now: Date): string[] {
  const days = new Set<string>();
  for (const iso of startsAts) {
    const d = new Date(iso);
    if (d.getTime() > now.getTime()) days.add(etDay.format(d).replaceAll("-", ""));
  }
  return [...days].sort();
}

export async function fetchEspnGames(dateKeys: string[]): Promise<EspnGame[]> {
  const results = await Promise.allSettled(
    dateKeys.map(async (date) => {
      const url = new URL(ESPN_SCOREBOARD_URL);
      url.searchParams.set("groups", "80");
      url.searchParams.set("limit", "300");
      url.searchParams.set("dates", date);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`ESPN scoreboard ${date} failed: ${response.status}`);
      return parseEspnScoreboard(await response.json());
    }),
  );
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0 && failed.length === results.length) {
    throw (failed[0] as PromiseRejectedResult).reason;
  }
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

// ---- Matching Splash games to ESPN events ----
// Splash aliases and ESPN abbreviations agree for most teams but not all
// (NCST/NCSU, TXAM/TA&M, IND/IU, OKLA/OU...), and school names differ in
// other places ("Louisiana-Monroe" vs "UL Monroe"). A side matches if either
// the abbreviation or the school name agrees; across one week, every game
// had at least one side match and nearly all had both. Teams play once a
// week, so a kickoff window plus one matching team is already unambiguous.
// The window is wide because a not-yet-scheduled (TBD) kickoff is a
// placeholder on both sides, and they differ: ESPN uses midnight Eastern
// (05:00Z), Splash 18:00Z, 13 hours apart (a real miss with a 12h window).

const KICKOFF_WINDOW_MS = 48 * 60 * 60 * 1000;

const norm = (s: string | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

function sameTeam(splash: SlateGame["home"], espn: EspnTeam): boolean {
  const ours = new Set([norm(splash.alias), norm(splash.name)].filter(Boolean));
  return [espn.abbreviation, espn.location, espn.shortDisplayName].some((s) => ours.has(norm(s)));
}

export interface EspnMatch {
  event: EspnGame;
  flipped: boolean; // ESPN lists Splash's home team as away
}

export function matchEspnGame(game: SlateGame, events: EspnGame[]): EspnMatch | null {
  const kickoff = Date.parse(game.startsAt);
  let best: (EspnMatch & { score: number }) | null = null;
  for (const event of events) {
    if (Math.abs(Date.parse(event.startsAt) - kickoff) > KICKOFF_WINDOW_MS) continue;
    const straight = Number(sameTeam(game.home, event.home)) + Number(sameTeam(game.away, event.away));
    const crossed = Number(sameTeam(game.home, event.away)) + Number(sameTeam(game.away, event.home));
    const score = Math.max(straight, crossed);
    if (score > 0 && (!best || score > best.score)) {
      best = { event, flipped: crossed > straight, score };
    }
  }
  return best ? { event: best.event, flipped: best.flipped } : null;
}

const negate = (n: number | null) => (n == null ? null : n === 0 ? 0 : -n);

export function marketLineFor(match: EspnMatch): MarketLine | null {
  const line = match.event.line;
  if (!line || !match.flipped) return line;
  return { ...line, spread: negate(line.spread), spreadOpen: negate(line.spreadOpen) };
}

export type GameWithMarket = SlateGame & { market: MarketLine | null };

// A game with no ESPN line this time keeps whatever line it had before
// (ESPN drops odds around kickoff; that last number is the closing line).
export function attachMarketLines(
  games: SlateGame[],
  events: EspnGame[],
  previous: Map<string, MarketLine | null>,
): GameWithMarket[] {
  return games.map((game) => {
    const match = matchEspnGame(game, events);
    const fresh = match ? marketLineFor(match) : null;
    // Carried-over lines were saved before normalization existed, possibly
    // as "Draft Kings", and are kept for the rest of the week.
    const kept = previous.get(game.gameId) ?? null;
    const market = fresh ?? (kept && { ...kept, provider: normalizeProvider(kept.provider) });
    return { ...game, market };
  });
}
