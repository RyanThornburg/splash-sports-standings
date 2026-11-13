import { fetchMock } from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  attachMarketLines,
  espnDateKeys,
  fetchEspnGames,
  matchEspnGame,
  normalizeProvider,
  parseEspnScoreboard,
  parseLine,
  type EspnGame,
  type MarketLine,
} from "../src/odds";
import type { SlateGame } from "../src/picks";

// Trimmed from a real ESPN college-football scoreboard event (FSU @ Pitt,
// Nov 2026): the fields we read, in the shapes ESPN actually sends.
function espnEvent(overrides: {
  id?: string;
  date?: string;
  home?: [string, string, string];
  away?: [string, string, string];
  odds?: unknown[];
} = {}) {
  const team = ([abbreviation, location, shortDisplayName]: [string, string, string]) => ({
    abbreviation,
    location,
    shortDisplayName,
  });
  return {
    id: overrides.id ?? "401858293",
    date: overrides.date ?? "2026-11-14T00:00Z",
    competitions: [
      {
        competitors: [
          { homeAway: "home", team: team(overrides.home ?? ["PITT", "Pittsburgh", "Pitt"]) },
          { homeAway: "away", team: team(overrides.away ?? ["FSU", "Florida State", "Florida St"]) },
        ],
        odds: overrides.odds ?? [
          {
            provider: { name: "DraftKings" },
            details: "PITT -3.5",
            overUnder: 52.5,
            spread: -3.5,
            pointSpread: {
              home: { close: { line: "-3.5", odds: "-102" }, open: { line: "-3", odds: "-105" } },
              away: { close: { line: "+3.5", odds: "-118" }, open: { line: "+3", odds: "-115" } },
            },
            total: {
              over: { close: { line: "o52.5", odds: "-105" }, open: { line: "o53.5", odds: "-110" } },
              under: { close: { line: "u52.5", odds: "-115" }, open: { line: "u53.5", odds: "-110" } },
            },
          },
        ],
      },
    ],
  };
}

function splashGame(overrides: Partial<SlateGame> & { homeAlias?: string; homeName?: string; awayAlias?: string; awayName?: string; homeSpread?: number } = {}): SlateGame {
  const homeSpread = overrides.homeSpread ?? -3.5;
  return {
    gameId: overrides.gameId ?? "g1",
    startsAt: overrides.startsAt ?? "2026-11-14T00:00:00.000Z",
    status: overrides.status ?? "scheduled",
    state: null,
    home: { alias: overrides.homeAlias ?? "PITT", name: overrides.homeName ?? "Pittsburgh", spread: homeSpread, score: null },
    away: { alias: overrides.awayAlias ?? "FSU", name: overrides.awayName ?? "Florida State", spread: -homeSpread, score: null },
  };
}

describe("parseLine", () => {
  it("reads ESPN's signed and over/under strings", () => {
    expect(parseLine("-3.5")).toBe(-3.5);
    expect(parseLine("+3")).toBe(3);
    expect(parseLine("o52.5")).toBe(52.5);
    expect(parseLine("u52.5")).toBe(52.5);
  });

  it("treats pick'em spellings as zero and junk as missing", () => {
    expect(parseLine("PK")).toBe(0);
    expect(parseLine("EVEN")).toBe(0);
    expect(parseLine(undefined)).toBeNull();
    expect(parseLine("OFF")).toBeNull();
  });
});

describe("normalizeProvider", () => {
  it("settles ESPN's two spellings of DraftKings (seen five minutes apart)", () => {
    expect(normalizeProvider("Draft Kings")).toBe("DraftKings");
    expect(normalizeProvider("DraftKings")).toBe("DraftKings");
    expect(normalizeProvider(" draftkings ")).toBe("DraftKings");
  });

  it("keeps unknown books as sent and falls back to Market when blank", () => {
    expect(normalizeProvider("Some Book")).toBe("Some Book");
    expect(normalizeProvider(undefined)).toBe("Market");
    expect(normalizeProvider("  ")).toBe("Market");
  });
});

describe("parseEspnScoreboard", () => {
  it("pulls the current and opening spread and total from ESPN's home side", () => {
    const [game] = parseEspnScoreboard({ events: [espnEvent()] });

    expect(game.home.abbreviation).toBe("PITT");
    expect(game.line).toEqual({ provider: "DraftKings", spreadOpen: -3, spread: -3.5, totalOpen: 53.5, total: 52.5 });
  });

  it("falls back to the summary spread/overUnder when pointSpread is missing", () => {
    const [game] = parseEspnScoreboard({
      events: [espnEvent({ odds: [{ provider: { name: "DraftKings" }, spread: 7, overUnder: 48 }] })],
    });

    expect(game.line).toEqual({ provider: "DraftKings", spreadOpen: null, spread: 7, totalOpen: null, total: 48 });
  });

  it("leaves line null when ESPN has no odds (e.g. after kickoff)", () => {
    const [game] = parseEspnScoreboard({ events: [espnEvent({ odds: [] })] });

    expect(game.line).toBeNull();
  });
});

describe("matchEspnGame", () => {
  const events = parseEspnScoreboard({
    events: [
      espnEvent(),
      // Real mismatches from the same week: Splash NCST/TXAM vs ESPN NCSU/TA&M.
      espnEvent({ id: "2", home: ["NCSU", "NC State", "NC State"], away: ["SYR", "Syracuse", "Syracuse"] }),
      espnEvent({ id: "3", home: ["TA&M", "Texas A&M", "Texas A&M"], away: ["TENN", "Tennessee", "Tennessee"] }),
    ],
  });

  it("matches on abbreviations", () => {
    expect(matchEspnGame(splashGame(), events)?.event.id).toBe("401858293");
  });

  it("matches a side by school name when the abbreviations differ", () => {
    const game = splashGame({ homeAlias: "NCST", homeName: "NC State", awayAlias: "SYR", awayName: "Syracuse" });

    expect(matchEspnGame(game, events)).toMatchObject({ event: { id: "2" }, flipped: false });
  });

  it("matches on one side alone when the other differs both ways", () => {
    const game = splashGame({ homeAlias: "TXAM", homeName: "Texas A and M", awayAlias: "TENN", awayName: "Tennessee" });

    expect(matchEspnGame(game, events)?.event.id).toBe("3");
  });

  it("notices when ESPN lists the teams the other way round", () => {
    const game = splashGame({ homeAlias: "FSU", homeName: "Florida State", awayAlias: "PITT", awayName: "Pittsburgh" });

    expect(matchEspnGame(game, events)).toMatchObject({ event: { id: "401858293" }, flipped: true });
  });

  it("matches a TBD kickoff despite the two sites' different placeholder times", () => {
    const tbd = parseEspnScoreboard({ events: [espnEvent({ date: "2026-11-21T05:00Z" })] });
    const game = splashGame({ startsAt: "2026-11-21T18:00:00.000Z" });

    expect(matchEspnGame(game, tbd)?.event.id).toBe("401858293");
  });

  it("ignores the same teams in a different week", () => {
    const game = splashGame({ startsAt: "2026-11-21T00:00:00.000Z" });

    expect(matchEspnGame(game, events)).toBeNull();
  });
});

describe("attachMarketLines", () => {
  it("flips ESPN's spread to Splash's home side for a reversed listing", () => {
    const events = parseEspnScoreboard({ events: [espnEvent()] });
    const game = splashGame({ homeAlias: "FSU", homeName: "Florida State", awayAlias: "PITT", awayName: "Pittsburgh", homeSpread: 3.5 });

    const [result] = attachMarketLines([game], events, new Map());

    expect(result.market).toMatchObject({ spread: 3.5, spreadOpen: 3, total: 52.5, totalOpen: 53.5 });
  });

  it("normalizes the book name on a carried-over line saved before normalization", () => {
    const previous: MarketLine = { provider: "Draft Kings", spreadOpen: -3, spread: -4, totalOpen: 50, total: 51 };

    const [result] = attachMarketLines([splashGame()], [], new Map([["g1", previous]]));

    expect(result.market?.provider).toBe("DraftKings");
  });

  it("keeps the last known line when ESPN no longer has one", () => {
    const previous: MarketLine = { provider: "DraftKings", spreadOpen: -3, spread: -4, totalOpen: 50, total: 51 };
    const noOdds: EspnGame[] = parseEspnScoreboard({ events: [espnEvent({ odds: [] })] });

    const [result] = attachMarketLines([splashGame()], noOdds, new Map([["g1", previous]]));

    expect(result.market).toEqual(previous);
  });

  it("is null for a game ESPN never had", () => {
    const [result] = attachMarketLines([splashGame()], [], new Map());

    expect(result.market).toBeNull();
  });
});

describe("espnDateKeys", () => {
  it("uses Eastern calendar days and skips games already kicked off", () => {
    const now = new Date("2026-11-13T12:00:00Z");
    const keys = espnDateKeys(
      [
        "2026-11-12T00:30:00.000Z", // already played
        "2026-11-15T03:30:00.000Z", // Sat 10:30 PM ET, still Saturday
        "2026-11-14T17:00:00.000Z", // Sat noon ET
        "2026-11-14T00:00:00.000Z", // Fri 7 PM ET
      ],
      now,
    );

    expect(keys).toEqual(["20261113", "20261114"]);
  });
});

describe("fetchEspnGames", () => {
  beforeAll(() => {
    fetchMock.activate();
    fetchMock.disableNetConnect();
  });

  afterEach(() => {
    fetchMock.assertNoPendingInterceptors();
  });

  it("asks ESPN for FBS games one day at a time and merges the days", async () => {
    const espn = fetchMock.get("https://site.api.espn.com");
    espn
      .intercept({ path: (p) => p.includes("groups=80") && p.includes("dates=20261113"), method: "GET" })
      .reply(200, { events: [espnEvent()] });
    espn
      .intercept({ path: (p) => p.includes("dates=20261114"), method: "GET" })
      .reply(200, { events: [espnEvent({ id: "2" })] });

    const games = await fetchEspnGames(["20261113", "20261114"]);

    expect(games.map((g) => g.id).sort()).toEqual(["2", "401858293"]);
  });

  it("returns what it got when only some days fail", async () => {
    const espn = fetchMock.get("https://site.api.espn.com");
    espn.intercept({ path: (p) => p.includes("dates=20261113"), method: "GET" }).reply(200, { events: [espnEvent()] });
    espn.intercept({ path: (p) => p.includes("dates=20261114"), method: "GET" }).reply(500, "");

    const games = await fetchEspnGames(["20261113", "20261114"]);

    expect(games).toHaveLength(1);
  });

  it("throws when every day fails", async () => {
    fetchMock
      .get("https://site.api.espn.com")
      .intercept({ path: (p) => p.includes("dates=20261113"), method: "GET" })
      .reply(400, { code: 400, message: "Failed to get events endpoint." });

    await expect(fetchEspnGames(["20261113"])).rejects.toThrow("ESPN scoreboard 20261113 failed: 400");
  });
});
