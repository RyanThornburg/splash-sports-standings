import { fetchMock } from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  computePendingCount,
  computePoolPickCounts,
  computeTeamAggregates,
  fetchSlateWeeks,
  type WeeklyEntryResult,
  type WeeklyPick,
} from "../src/picks";

function pick(overrides: Partial<WeeklyPick> = {}): WeeklyPick {
  return {
    gameId: "game-1",
    team: { alias: "OKST", name: "Oklahoma State" },
    spread: -13.5,
    grade: "won",
    effectivePoints: 1,
    ...overrides,
  };
}

function week(picks: WeeklyPick[], overrides: Partial<WeeklyEntryResult> = {}): WeeklyEntryResult {
  return { wins: 0, losses: 0, ties: null, potentialPoints: 0, picks, ...overrides } as WeeklyEntryResult;
}

describe("computeTeamAggregates", () => {
  it("tallies picks and win/loss record per team across weeks", () => {
    const weeks = [
      week([pick({ team: { alias: "LSU", name: "LSU" }, grade: "won" })]),
      week([pick({ team: { alias: "LSU", name: "LSU" }, grade: "lost" })]),
      week([pick({ team: { alias: "OKST", name: "Oklahoma State" }, grade: "won" })]),
    ];

    const result = computeTeamAggregates(weeks);

    expect(result).toEqual([
      { teamAlias: "LSU", teamName: "LSU", picks: 2, wins: 1, losses: 1 },
      { teamAlias: "OKST", teamName: "Oklahoma State", picks: 1, wins: 1, losses: 0 },
    ]);
  });

  it("sorts by pick count descending, then team name alphabetically", () => {
    const weeks = [
      week([
        pick({ team: { alias: "Z", name: "Zeta" }, grade: "won" }),
        pick({ team: { alias: "A", name: "Alpha" }, grade: "won" }),
        pick({ team: { alias: "M", name: "Mid" }, grade: "won" }),
      ]),
    ];

    const result = computeTeamAggregates(weeks);

    expect(result.map((r) => r.teamAlias)).toEqual(["A", "M", "Z"]);
  });

  it("doesn't count a push toward wins or losses", () => {
    const weeks = [week([pick({ grade: "push" })])];

    const result = computeTeamAggregates(weeks);

    expect(result).toEqual([{ teamAlias: "OKST", teamName: "Oklahoma State", picks: 1, wins: 0, losses: 0 }]);
  });

  it("returns an empty array for no weeks", () => {
    expect(computeTeamAggregates([])).toEqual([]);
  });
});

describe("computePoolPickCounts", () => {
  it("tallies pick counts per game/team across every entry in the map, not just filtered ones", () => {
    const weekByHandle = new Map<string, WeeklyEntryResult>([
      ["Rattly", week([pick({ gameId: "g1", team: { alias: "OSU", name: "Ohio State" } })])],
      ["SomeRandomEntrant", week([pick({ gameId: "g1", team: { alias: "OSU", name: "Ohio State" } })])],
      ["AnotherEntrant", week([pick({ gameId: "g1", team: { alias: "MICH", name: "Michigan" } })])],
    ]);

    const result = computePoolPickCounts(weekByHandle);

    expect(result).toEqual(
      expect.arrayContaining([
        { gameId: "g1", team: { alias: "OSU", name: "Ohio State" }, count: 2 },
        { gameId: "g1", team: { alias: "MICH", name: "Michigan" }, count: 1 },
      ]),
    );
    expect(result).toHaveLength(2);
  });

  it("returns an empty array when nobody has picks yet", () => {
    expect(computePoolPickCounts(new Map())).toEqual([]);
  });
});

describe("computePendingCount", () => {
  // Deliberately keyed off potentialPoints - wins (Splash's own precomputed
  // max-reachable-score), not off individual pick grades or our own
  // picksRequiredCount - decided math — see the function's doc comment for
  // why. The `picks` array content is irrelevant here by design; these
  // tests intentionally leave it empty.
  it("counts required picks not yet decided", () => {
    const w = week([], { wins: 10, potentialPoints: 11 });
    expect(computePendingCount(w)).toBe(1);
  });

  it("is fully pending when nothing has been decided yet", () => {
    const w = week([], { wins: 0, potentialPoints: 20 });
    expect(computePendingCount(w)).toBe(20);
  });

  it("is zero once every required pick is decided", () => {
    const w = week([], { wins: 1, potentialPoints: 1 });
    expect(computePendingCount(w)).toBe(0);
  });

  // Regression: this must stay independent of individual pick grades.
  // Splash has surprised us twice with grade/status strings we hadn't seen
  // ("winning"/"losing" as a live, non-final grade; "finished" as a second
  // terminal game status) — counting grades ourselves caused pending counts
  // to be off by one in production. potentialPoints - wins already excludes
  // in-progress picks correctly regardless of what grade string is used.
  it("ignores pick grades entirely, even ones we don't recognize", () => {
    const w = week([pick({ grade: "some-future-grade-value-we-dont-know-about" as never })], {
      wins: 10,
      potentialPoints: 11,
    });
    expect(computePendingCount(w)).toBe(1);
  });
});

describe("fetchSlateWeeks", () => {
  beforeAll(() => {
    fetchMock.activate();
    fetchMock.disableNetConnect();
  });

  afterEach(() => {
    fetchMock.assertNoPendingInterceptors();
  });

  // Shape confirmed against a real captured response for this exact
  // slateId+picksSlateId (no entryId) leaderboard call. Regression test for a
  // real bug: fetchEntryWeek (this function's predecessor, one HTTP call per
  // filtered user via `&entryId=`) was replaced with this single
  // whole-slate-then-filter-locally call after discovering the entryId-scoped
  // variant returns a thinner payload (no `picks`, no `potential_points`
  // metric) — this test locks in that the richer shape parses correctly so a
  // future change can't silently regress back to NaN pending counts.
  it("parses potentialPoints out of the metrics array, keyed by handle", async () => {
    fetchMock
      .get("https://api.splashsports.com")
      .intercept({ path: (path) => path.includes("slateId=slate_1"), method: "GET" })
      .reply(200, {
        data: [
          {
            user: { handle: "Nick_Carteaux" },
            metadata: { record: { wins: 11, losses: 8, ties: null } },
            metrics: [
              { type: "wins", value: 11, label: "Wins", displayValue: "11-8" },
              { type: "potential_points", value: 12, label: "Pot Pts", displayValue: "12" },
            ],
            picks: { data: [] },
          },
        ],
        nextCursor: null,
      });

    const result = await fetchSlateWeeks("token", "contest_1", "slate_1");

    expect(result.get("Nick_Carteaux")).toEqual({
      wins: 11,
      losses: 8,
      ties: null,
      potentialPoints: 12,
      picks: [],
    });
  });

  it("falls back to wins (zero pending) when potential_points is absent from metrics", async () => {
    fetchMock
      .get("https://api.splashsports.com")
      .intercept({ path: (path) => path.includes("slateId=slate_2"), method: "GET" })
      .reply(200, {
        data: [
          {
            user: { handle: "Rattly" },
            metadata: { record: { wins: 11, losses: 8, ties: null } },
            metrics: [{ type: "wins", value: 11, label: "Wins", displayValue: "11-8" }],
            picks: null,
          },
        ],
        nextCursor: null,
      });

    const result = await fetchSlateWeeks("token", "contest_1", "slate_2");

    expect(result.get("Rattly")?.potentialPoints).toBe(11);
    expect(result.get("Rattly")?.picks).toEqual([]);
  });
});
