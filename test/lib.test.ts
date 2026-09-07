import { describe, expect, it } from "vitest";
import {
  computeGroupTrends,
  computePoolTopPicks,
  computeSeasonPoolTopTeams,
  computeWeeklyPending,
  FINISHED_STATUSES,
  gameHeaderLines,
  isLiveGame,
  pickCellClass,
  recordText,
  sortGameIds,
  winPct,
  withGroupRank,
} from "../public/lib.js";

function entry(overrides = {}) {
  return { rank: 1, displayRank: "1", handle: "A", displayName: null, score: 10, wins: 10, losses: 5, ties: null, ...overrides };
}

function game(overrides = {}) {
  return {
    gameId: "g1",
    startsAt: "2026-09-06T20:00:00.000Z",
    status: "scheduled",
    state: null,
    home: { alias: "HOME", name: "Home Team", spread: -3.5, score: null },
    away: { alias: "AWAY", name: "Away Team", spread: 3.5, score: null },
    ...overrides,
  };
}

function pick(overrides = {}) {
  return { gameId: "g1", team: { alias: "HOME", name: "Home Team" }, spread: -3.5, grade: null, effectivePoints: null, ...overrides };
}

describe("recordText", () => {
  it("formats wins-losses", () => {
    expect(recordText(entry({ wins: 11, losses: 7, ties: null }))).toBe("11-7");
  });

  it("appends ties when present", () => {
    expect(recordText(entry({ wins: 11, losses: 7, ties: 1 }))).toBe("11-7-1");
  });

  it("omits ties when zero", () => {
    expect(recordText(entry({ wins: 11, losses: 7, ties: 0 }))).toBe("11-7");
  });
});

describe("winPct", () => {
  it("rounds to a whole percent", () => {
    expect(winPct(entry({ wins: 11, losses: 7 }))).toBe("61%");
  });

  it("returns a dash with no decided games", () => {
    expect(winPct(entry({ wins: 0, losses: 0 }))).toBe("-");
  });
});

describe("withGroupRank", () => {
  it("ranks sequentially by position when scores differ", () => {
    const entries = [entry({ handle: "A", score: 11 }), entry({ handle: "B", score: 10 }), entry({ handle: "C", score: 9 })];
    const result = withGroupRank(entries);
    expect(result.map((r: { groupRankLabel: string }) => r.groupRankLabel)).toEqual(["1", "2", "3"]);
  });

  it("marks ties with a T prefix and shares the same rank", () => {
    const entries = [entry({ handle: "A", score: 11 }), entry({ handle: "B", score: 11 }), entry({ handle: "C", score: 9 })];
    const result = withGroupRank(entries);
    expect(result.map((r: { groupRankLabel: string }) => r.groupRankLabel)).toEqual(["T1", "T1", "3"]);
  });

  // Regression: equal score alone isn't a real tie once tiebreakerDiff is
  // known — two filtered users can share a score but still be fully
  // separated by Splash's own (lower-is-better) tiebreaker, and the incoming
  // order already reflects that separation.
  it("breaks an equal-score tie using tiebreakerDiff instead of showing a shared T-rank", () => {
    const entries = [
      entry({ handle: "A", score: 11, tiebreakerDiff: 19 }),
      entry({ handle: "B", score: 11, tiebreakerDiff: 35 }),
      entry({ handle: "C", score: 9, tiebreakerDiff: 5 }),
    ];
    const result = withGroupRank(entries);
    expect(result.map((r: { groupRankLabel: string }) => r.groupRankLabel)).toEqual(["1", "2", "3"]);
  });

  it("still ties when score and tiebreakerDiff are both identical", () => {
    const entries = [
      entry({ handle: "A", score: 11, tiebreakerDiff: 19 }),
      entry({ handle: "B", score: 11, tiebreakerDiff: 19 }),
    ];
    const result = withGroupRank(entries);
    expect(result.map((r: { groupRankLabel: string }) => r.groupRankLabel)).toEqual(["T1", "T1"]);
  });
});

describe("computeWeeklyPending", () => {
  it("subtracts wins from potentialPoints (Splash's own max-reachable-score)", () => {
    expect(computeWeeklyPending({ wins: 10, losses: 9, ties: null, potentialPoints: 11, picks: [] })).toBe(1);
  });

  it("is zero once potentialPoints equals wins", () => {
    expect(computeWeeklyPending({ wins: 9, losses: 9, ties: 1, potentialPoints: 9, picks: [] })).toBe(0);
  });
});

describe("isLiveGame / FINISHED_STATUSES", () => {
  it("treats scheduled as not live", () => {
    expect(isLiveGame(game({ status: "scheduled" }))).toBe(false);
  });

  it("treats both terminal statuses as not live", () => {
    expect(isLiveGame(game({ status: "finalized" }))).toBe(false);
    expect(isLiveGame(game({ status: "finished" }))).toBe(false);
  });

  it("treats in_progress as live", () => {
    expect(isLiveGame(game({ status: "in_progress" }))).toBe(true);
  });

  it("treats a missing game as not live", () => {
    expect(isLiveGame(undefined)).toBe(false);
  });

  it("exports exactly the two known terminal statuses", () => {
    expect(FINISHED_STATUSES.has("finalized")).toBe(true);
    expect(FINISHED_STATUSES.has("finished")).toBe(true);
    expect(FINISHED_STATUSES.has("in_progress")).toBe(false);
  });
});

describe("gameHeaderLines", () => {
  it("shows the home team's own spread on the matchup line, with a sign for a positive spread", () => {
    const { matchup, detail, live } = gameHeaderLines(
      game({ status: "scheduled", home: { alias: "CAL", name: "California", spread: 1.5, score: null } }),
    );
    expect(matchup).toBe("AWAY @ CAL (+1.5)");
    expect(detail).toBeNull();
    expect(live).toBe(false);
  });

  it("shows a live score and marks live=true while in progress", () => {
    const { detail, live } = gameHeaderLines(
      game({ status: "in_progress", home: { alias: "HOME", name: "H", spread: -3.5, score: 10 }, away: { alias: "AWAY", name: "A", spread: 3.5, score: 7 } }),
    );
    expect(detail).toBe("LIVE 7-10");
    expect(live).toBe(true);
  });

  it("shows a final score and marks live=false once finished", () => {
    const { detail, live } = gameHeaderLines(
      game({ status: "finalized", home: { alias: "HOME", name: "H", spread: -3.5, score: 20 }, away: { alias: "AWAY", name: "A", spread: 3.5, score: 14 } }),
    );
    expect(detail).toBe("F 14-20");
    expect(live).toBe(false);
  });

  it("includes quarter/clock only when state is present", () => {
    const { clock } = gameHeaderLines(game({ status: "in_progress", state: { quarter: 1, clock: "14:38" } }));
    expect(clock).toBe("Q1 14:38");
  });
});

describe("sortGameIds", () => {
  it("puts live games before everything else", () => {
    const gamesById = new Map([
      ["scheduled-game", game({ gameId: "scheduled-game", status: "scheduled", startsAt: "2026-09-06T18:00:00.000Z" })],
      ["live-game", game({ gameId: "live-game", status: "in_progress", startsAt: "2026-09-06T20:00:00.000Z" })],
      ["finished-game", game({ gameId: "finished-game", status: "finalized", startsAt: "2026-09-06T17:00:00.000Z" })],
    ]);
    expect(sortGameIds(["scheduled-game", "finished-game", "live-game"], gamesById)).toEqual([
      "live-game",
      "finished-game",
      "scheduled-game",
    ]);
  });

  it("otherwise sorts chronologically by kickoff", () => {
    const gamesById = new Map([
      ["later", game({ gameId: "later", startsAt: "2026-09-06T22:00:00.000Z" })],
      ["earlier", game({ gameId: "earlier", startsAt: "2026-09-06T18:00:00.000Z" })],
    ]);
    expect(sortGameIds(["later", "earlier"], gamesById)).toEqual(["earlier", "later"]);
  });

  it("breaks a kickoff tie by home team alias", () => {
    const gamesById = new Map([
      ["z-home", game({ gameId: "z-home", home: { alias: "ZETA", name: "Z", spread: -3.5, score: null } })],
      ["a-home", game({ gameId: "a-home", home: { alias: "ALPHA", name: "A", spread: -3.5, score: null } })],
    ]);
    expect(sortGameIds(["z-home", "a-home"], gamesById)).toEqual(["a-home", "z-home"]);
  });
});

describe("pickCellClass", () => {
  it("prefers a final grade over any score-based computation", () => {
    expect(pickCellClass(pick({ grade: "won" }), game())).toBe("pick-won");
    expect(pickCellClass(pick({ grade: "lost" }), game())).toBe("pick-lost");
    expect(pickCellClass(pick({ grade: "push" }), game())).toBe("pick-push");
  });

  it("maps Splash's own live grade directly", () => {
    expect(pickCellClass(pick({ grade: "winning" }), game())).toBe("pick-live-winning");
    expect(pickCellClass(pick({ grade: "losing" }), game())).toBe("pick-live-losing");
  });

  it("falls back to score-based covering math when grade is null and the game is live", () => {
    const liveGame = game({
      status: "in_progress",
      home: { alias: "HOME", name: "H", spread: -3.5, score: 10 },
      away: { alias: "AWAY", name: "A", spread: 3.5, score: 0 },
    });
    // Picked HOME (-3.5), leading by 10 => covering.
    expect(pickCellClass(pick({ grade: null, team: { alias: "HOME", name: "H" }, spread: -3.5 }), liveGame)).toBe(
      "pick-live-winning",
    );
    // Picked AWAY (+3.5), down by 10 => 0-10+3.5 = -6.5, not covering.
    expect(pickCellClass(pick({ grade: null, team: { alias: "AWAY", name: "A" }, spread: 3.5 }), liveGame)).toBe(
      "pick-live-losing",
    );
  });

  it("is pending when grade is null and the game hasn't started", () => {
    expect(pickCellClass(pick({ grade: null }), game({ status: "scheduled" }))).toBe("pick-pending");
  });

  // Regression: this is what makes pool-wide picks (which never have a
  // per-pick `grade` — we only track team+spread for the ~120 entrants
  // outside our filtered group) show a real result once their game ends,
  // instead of the old fallback's permanent "pending" for anything not live.
  it("computes won/lost/push purely from score+spread once the game is finished, with no grade at all", () => {
    const finishedGame = game({
      status: "finalized",
      home: { alias: "HOME", name: "H", spread: -3.5, score: 24 },
      away: { alias: "AWAY", name: "A", spread: 3.5, score: 10 },
    });
    expect(pickCellClass({ team: { alias: "HOME" }, spread: -3.5, grade: null }, finishedGame)).toBe("pick-won");
    expect(pickCellClass({ team: { alias: "AWAY" }, spread: 3.5, grade: null }, finishedGame)).toBe("pick-lost");
  });
});

function weekEntry(picks: unknown[]) {
  return { wins: 0, losses: 0, ties: null, potentialPoints: 0, picks };
}

describe("computeGroupTrends", () => {
  it("includes a consensus pick once enough users agree, tagged with its live status", () => {
    const users = {
      A: weekEntry([pick({ gameId: "g1", team: { alias: "OSU", name: "Ohio State" }, spread: -3.5, grade: "won" })]),
      B: weekEntry([pick({ gameId: "g1", team: { alias: "OSU", name: "Ohio State" }, spread: -3.5, grade: "won" })]),
      C: weekEntry([pick({ gameId: "g1", team: { alias: "OSU", name: "Ohio State" }, spread: -3.5, grade: "won" })]),
    };
    const gamesById = new Map([["g1", game({ gameId: "g1" })]]);
    expect(computeGroupTrends(users, gamesById)).toEqual([
      {
        gameId: "g1",
        teams: [
          {
            team: { alias: "OSU", name: "Ohio State" },
            handles: ["A", "B", "C"],
            count: 3,
            statusClass: "pick-won",
          },
        ],
        isConsensus: true,
        isSplit: false,
        maxCount: 3,
      },
    ]);
  });

  it("includes a head-to-head split even below the consensus threshold, identifying the winning side", () => {
    const finishedGame = game({
      gameId: "g1",
      status: "finalized",
      home: { alias: "OSU", name: "Ohio State", spread: -3.5, score: 24 },
      away: { alias: "MICH", name: "Michigan", spread: 3.5, score: 10 },
    });
    const users = {
      A: weekEntry([pick({ gameId: "g1", team: { alias: "OSU", name: "Ohio State" }, spread: -3.5, grade: null })]),
      B: weekEntry([pick({ gameId: "g1", team: { alias: "MICH", name: "Michigan" }, spread: 3.5, grade: null })]),
    };
    const result = computeGroupTrends(users, new Map([["g1", finishedGame]]));
    expect(result).toHaveLength(1);
    expect(result[0].isSplit).toBe(true);
    expect(result[0].isConsensus).toBe(false);
    const [osuRow, michRow] = result[0].teams;
    expect(osuRow).toMatchObject({ team: { alias: "OSU" }, statusClass: "pick-won" });
    expect(michRow).toMatchObject({ team: { alias: "MICH" }, statusClass: "pick-lost" });
  });

  it("drops a game with too few agreeing picks and no disagreement", () => {
    const users = {
      A: weekEntry([pick({ gameId: "g1", team: { alias: "OSU", name: "Ohio State" } })]),
      B: weekEntry([pick({ gameId: "g1", team: { alias: "OSU", name: "Ohio State" } })]),
    };
    expect(computeGroupTrends(users, new Map())).toEqual([]);
  });

  it("respects a custom consensusThreshold", () => {
    const users = {
      A: weekEntry([pick({ gameId: "g1", team: { alias: "OSU", name: "Ohio State" } })]),
      B: weekEntry([pick({ gameId: "g1", team: { alias: "OSU", name: "Ohio State" } })]),
    };
    expect(computeGroupTrends(users, new Map(), { consensusThreshold: 2 })[0].isConsensus).toBe(true);
  });
});

describe("computePoolTopPicks", () => {
  it("sorts by count descending, computes percent of the pool, truncates to topX, and tags status", () => {
    const finishedGame = game({
      gameId: "g2",
      status: "finalized",
      home: { alias: "ALA", name: "Alabama", spread: -3.5, score: 24 },
      away: { alias: "AUB", name: "Auburn", spread: 3.5, score: 10 },
    });
    const counts = [
      { gameId: "g1", team: { alias: "OSU", name: "Ohio State" }, count: 80 },
      { gameId: "g1", team: { alias: "MICH", name: "Michigan" }, count: 20 },
      { gameId: "g2", team: { alias: "ALA", name: "Alabama" }, count: 90 },
    ];
    const gamesById = new Map([["g2", finishedGame]]);
    const result = computePoolTopPicks(counts, 100, gamesById, 2);
    expect(result).toEqual([
      { gameId: "g2", team: { alias: "ALA", name: "Alabama" }, count: 90, pct: 90, statusClass: "pick-won" },
      { gameId: "g1", team: { alias: "OSU", name: "Ohio State" }, count: 80, pct: 80, statusClass: "pick-pending" },
    ]);
  });

  it("returns 0% rather than dividing by zero when the pool is empty", () => {
    const counts = [{ gameId: "g1", team: { alias: "OSU", name: "Ohio State" }, count: 0 }];
    expect(computePoolTopPicks(counts, 0, new Map())[0].pct).toBe(0);
  });
});

describe("computeSeasonPoolTopTeams", () => {
  it("sums a team's pick count across every slate, keyed by team alias rather than gameId", () => {
    const slates = [
      { poolPickCounts: [{ gameId: "g1", team: { alias: "OSU", name: "Ohio State" }, count: 80 }] },
      { poolPickCounts: [{ gameId: "g9", team: { alias: "OSU", name: "Ohio State" }, count: 70 }] },
    ];
    expect(computeSeasonPoolTopTeams(slates)).toEqual([{ team: { alias: "OSU", name: "Ohio State" }, count: 150 }]);
  });

  it("tolerates a slate with no poolPickCounts (cached before this field existed)", () => {
    expect(computeSeasonPoolTopTeams([{ poolPickCounts: undefined }])).toEqual([]);
  });
});
