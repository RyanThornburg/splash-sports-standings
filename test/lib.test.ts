import { describe, expect, it } from "vitest";
import {
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
});

describe("computeWeeklyPending", () => {
  it("subtracts decided picks (wins+losses+ties) from the required count", () => {
    expect(computeWeeklyPending({ wins: 10, losses: 9, ties: null, picks: [] }, 20)).toBe(1);
  });

  it("counts ties toward decided", () => {
    expect(computeWeeklyPending({ wins: 9, losses: 9, ties: 1, picks: [] }, 20)).toBe(1);
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
});
