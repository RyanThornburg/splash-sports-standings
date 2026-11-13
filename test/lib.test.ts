import { describe, expect, it } from "vitest";
import {
  computeGroupTrends,
  computePoolTopPicks,
  computeSeasonPoolTopTeams,
  computeWeeklyPending,
  bookNames,
  defaultLinesSlateId,
  linesBook,
  defaultSlateId,
  FINISHED_STATUSES,
  formatSpread,
  gameHeaderLines,
  isLiveGame,
  kickoffDayWord,
  kickoffDays,
  lineEdge,
  lineText,
  linesSections,
  linesWeekState,
  paidGroups,
  valuePick,
  valueResult,
  valueTally,
  valueTier,
  pickCellClass,
  picksByGame,
  pickStatus,
  rankGroupTrends,
  recordText,
  relativeTime,
  sortGameIds,
  weekInProgress,
  weeklySections,
  weekStandings,
  weekState,
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

describe("formatSpread", () => {
  it("signs positive spreads and keeps negatives", () => {
    expect(formatSpread(3.5)).toBe("+3.5");
    expect(formatSpread(-7)).toBe("-7");
  });

  it("calls a zero spread a pick'em and blanks a missing one", () => {
    expect(formatSpread(0)).toBe("PK");
    expect(formatSpread(null)).toBe("");
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-10-04T20:00:00Z");

  it("says just now under a minute", () => {
    expect(relativeTime("2026-10-04T19:59:30Z", now)).toBe("just now");
  });

  it("counts minutes, then hours, then days", () => {
    expect(relativeTime("2026-10-04T19:57:00Z", now)).toBe("3 min ago");
    expect(relativeTime("2026-10-04T17:00:00Z", now)).toBe("3 hr ago");
    expect(relativeTime("2026-10-03T19:00:00Z", now)).toBe("yesterday");
    expect(relativeTime("2026-10-01T19:00:00Z", now)).toBe("3 days ago");
  });

  it("returns null with no timestamp", () => {
    expect(relativeTime(null, now)).toBeNull();
  });
});

describe("defaultSlateId", () => {
  const withPicks = (id) => ({ id, users: { A: { picks: [pick()] } } });
  const empty = (id) => ({ id, users: { A: { picks: [] } } });

  it("skips trailing weeks nobody has picked yet", () => {
    expect(defaultSlateId([withPicks("w4"), withPicks("w5"), empty("w6")])).toBe("w5");
  });

  it("falls back to the latest week when none have picks", () => {
    expect(defaultSlateId([empty("w1"), { id: "w2" }])).toBe("w2");
  });

  it("returns null with no weeks", () => {
    expect(defaultSlateId([])).toBeNull();
  });
});

describe("weekStandings", () => {
  const week = (wins, losses, potentialPoints = wins) => ({ wins, losses, ties: null, potentialPoints, picks: [] });

  it("ranks by wins then fewest losses, sharing tied ranks", () => {
    const rows = weekStandings({ A: week(6, 7), B: week(8, 6), C: week(6, 10), D: week(6, 7) });
    expect(rows.map((r) => [r.handle, r.rankLabel])).toEqual([
      ["B", "1"],
      ["A", "T2"],
      ["D", "T2"],
      ["C", "4"],
    ]);
  });

  it("reports picks left the same way as computeWeeklyPending", () => {
    expect(weekStandings({ A: week(8, 6, 14) })[0].pending).toBe(6);
  });
});

describe("pickStatus", () => {
  it("prefers Splash's grade", () => {
    expect(pickStatus(pick({ grade: "won" }), game())).toEqual({ tone: "good", live: false, label: "won" });
    expect(pickStatus(pick({ grade: "losing" }), game())).toEqual({ tone: "bad", live: true, label: "not covering" });
  });

  it("works out live cover status from the score when ungraded", () => {
    const live = game({
      status: "in_progress",
      home: { alias: "HOME", name: "Home Team", spread: -3.5, score: 21 },
      away: { alias: "AWAY", name: "Away Team", spread: 3.5, score: 14 },
    });
    expect(pickStatus(pick(), live)).toEqual({ tone: "good", live: true, label: "covering" });
  });

  it("marks a not-yet-started pick as pending", () => {
    expect(pickStatus(pick(), game())).toEqual({ tone: "pending", live: false, label: "not started" });
  });
});

describe("picksByGame / weeklySections", () => {
  const games = [
    game({ gameId: "final-early", status: "finalized", startsAt: "2026-10-03T16:00:00Z" }),
    game({ gameId: "final-late", status: "finished", startsAt: "2026-10-03T19:00:00Z" }),
    game({ gameId: "live", status: "in_progress", startsAt: "2026-10-03T20:00:00Z" }),
    game({ gameId: "later", status: "scheduled", startsAt: "2026-10-03T23:30:00Z" }),
    game({ gameId: "unpicked", status: "in_progress", startsAt: "2026-10-03T20:00:00Z" }),
  ];
  const gamesById = new Map(games.map((g) => [g.gameId, g]));
  const users = {
    A: { picks: [pick({ gameId: "final-early" }), pick({ gameId: "live" })] },
    B: { picks: [pick({ gameId: "live" }), pick({ gameId: "later" }), pick({ gameId: "final-late" })] },
  };

  it("groups every user's pick under its game", () => {
    expect(picksByGame(users).get("live")?.map((p) => p.handle)).toEqual(["A", "B"]);
  });

  it("splits only picked games into live, later and final (newest final first)", () => {
    const s = weeklySections(users, gamesById);
    expect(s.live.map((g) => g.gameId)).toEqual(["live"]);
    expect(s.later.map((g) => g.gameId)).toEqual(["later"]);
    expect(s.final.map((g) => g.gameId)).toEqual(["final-late", "final-early"]);
  });

  it("limits to one user's games for My picks", () => {
    const s = weeklySections(users, gamesById, "A");
    expect([...s.live, ...s.later, ...s.final].map((g) => g.gameId)).toEqual(["live", "final-early"]);
  });
});

describe("rankGroupTrends", () => {
  // Minimal computeGroupTrends-shaped rows: one entry per side.
  const row = (gameId, ...sides) => {
    const teams = sides
      .map(([alias, handles]) => ({ team: { alias }, handles, count: handles.length, statusClass: "pick-pending" }))
      .sort((a, b) => b.count - a.count);
    const maxCount = teams[0].count;
    return { gameId, teams, isSplit: teams.length > 1, isConsensus: maxCount >= 3, maxCount };
  };
  const rows = [
    row("oneVsOne", ["X", ["A"]], ["Y", ["B"]]),
    row("lock", ["X", ["A", "B", "C", "D", "E"]]),
    row("twoVsTwo", ["X", ["A", "B"]], ["Y", ["C", "D"]]),
    row("meAlone", ["X", ["B", "C", "D"]], ["Y", ["ME"]]),
    row("meCloser", ["X", ["B", "C"]], ["Y", ["ME"]]),
    row("threeAgree", ["X", ["A", "B", "C"]]),
  ];

  it("puts games where you're outnumbered first (biggest gap first), then 4+ locks, then fullest splits", () => {
    const ranked = rankGroupTrends(rows, "ME");
    expect(ranked.map((r) => r.gameId)).toEqual(["meAlone", "meCloser", "lock", "twoVsTwo", "threeAgree", "oneVsOne"]);
    expect(ranked.map((r) => r.reason)).toEqual(["outnumbered", "outnumbered", "lock", "split", "consensus", "split"]);
  });

  it("has no outnumbered tier for someone just looking", () => {
    const ranked = rankGroupTrends(rows, null);
    expect(ranked[0].gameId).toBe("lock");
    expect(ranked.some((r) => r.reason === "outnumbered")).toBe(false);
  });

  it("doesn't call you outnumbered when your side is bigger or level", () => {
    const ranked = rankGroupTrends([row("g", ["X", ["ME", "A"]], ["Y", ["B"]])], "ME");
    expect(ranked[0].reason).toBe("split");
  });
});

describe("weekState / weekInProgress", () => {
  const at = (gameId, status, startsAt) => game({ gameId, status, startsAt });
  const usersFor = (...ids) => ({ A: { picks: ids.map((gameId) => pick({ gameId })) } });
  const byId = (...gs) => new Map(gs.map((g) => [g.gameId, g]));

  it("is live while any picked game is being played", () => {
    const gs = byId(at("a", "in_progress", "2026-10-03T16:00:00Z"), at("b", "scheduled", "2026-10-03T20:00:00Z"));
    expect(weekState(usersFor("a", "b"), gs)).toEqual({ kind: "live", live: 1, later: 1 });
    expect(weekInProgress(usersFor("a", "b"), gs)).toBe(true);
  });

  it("is between games when some are done and more are to come, with the next kickoff", () => {
    const gs = byId(at("a", "finalized", "2026-10-03T16:00:00Z"), at("b", "scheduled", "2026-10-03T20:00:00Z"));
    expect(weekState(usersFor("a", "b"), gs)).toEqual({ kind: "between", later: 1, next: "2026-10-03T20:00:00Z" });
    expect(weekInProgress(usersFor("a", "b"), gs)).toBe(true);
  });

  it("is upcoming before anything kicks off, and not in progress", () => {
    const gs = byId(at("a", "scheduled", "2026-10-03T16:00:00Z"));
    expect(weekState(usersFor("a"), gs)).toEqual({ kind: "upcoming", next: "2026-10-03T16:00:00Z" });
    expect(weekInProgress(usersFor("a"), gs)).toBe(false);
  });

  it("is final with the first and last kickoff once every picked game is done", () => {
    const gs = byId(at("a", "finalized", "2026-09-26T16:00:00Z"), at("b", "finished", "2026-09-29T00:00:00Z"));
    expect(weekState(usersFor("a", "b"), gs)).toEqual({
      kind: "final",
      first: "2026-09-26T16:00:00Z",
      last: "2026-09-29T00:00:00Z",
    });
    expect(weekInProgress(usersFor("a", "b"), gs)).toBe(false);
  });

  it("is null with no picks", () => {
    expect(weekState({}, new Map())).toBeNull();
  });
});

describe("Lines helpers", () => {
  // Spreads from the home side, like Splash's picksheet and the Worker's
  // flipped market line.
  const game = (id: string, splashHome: number | null, marketHome?: number, startsAt = "2026-11-14T17:00:00Z") => ({
    gameId: id,
    startsAt,
    home: { alias: "PITT", name: "Pittsburgh", spread: splashHome },
    away: { alias: "FSU", name: "Florida State", spread: splashHome == null ? null : -splashHome },
    market: marketHome === undefined ? null : { provider: "DraftKings", spread: marketHome },
  });

  describe("lineText", () => {
    it("formats a home-side spread with a real minus, PK at zero", () => {
      expect(lineText(-3.5)).toBe("\u22123.5");
      expect(lineText(10.5)).toBe("+10.5");
      expect(lineText(0)).toBe("PK");
      expect(lineText(null)).toBeNull();
    });
  });

  describe("lineEdge", () => {
    it("gives the away team the edge when Splash makes home a bigger favourite than the market", () => {
      // Splash PITT -3.5, market PITT -2.5: FSU +3.5 on Splash is a point better.
      expect(lineEdge(game("g", -3.5, -2.5))).toMatchObject({ team: { alias: "FSU" }, points: 1 });
    });

    it("gives the home team the edge when the market moved toward them", () => {
      // Real Nov 2026 case: Splash OKLA +1.5, market OKLA -1.5.
      expect(lineEdge(game("g", 1.5, -1.5))).toMatchObject({ team: { alias: "PITT" }, points: 3 });
    });

    it("is zero-with-no-team when they agree, null without a market line", () => {
      expect(lineEdge(game("g", -3, -3))).toEqual({ team: null, points: 0 });
      expect(lineEdge(game("g", -3))).toBeNull();
    });
  });

  describe("bookNames / linesBook", () => {
    it("maps either spelling of a known book to its full and short names", () => {
      expect(bookNames("DraftKings")).toEqual({ full: "DraftKings", short: "DK" });
      expect(bookNames("Draft Kings")).toEqual({ full: "DraftKings", short: "DK" });
      expect(bookNames("Some Book")).toEqual({ full: "Some Book", short: "Some Book" });
      expect(bookNames("Market")).toBeNull();
      expect(bookNames(undefined)).toBeNull();
    });

    it("uses this week's book, else any week's, else null", () => {
      const slates = [
        { id: "w11", games: [game("a", -3, -3)] },
        { id: "w12", games: [game("b", -3)] },
      ];
      expect(linesBook(slates, "w11")).toEqual({ full: "DraftKings", short: "DK" });
      // Week 12 has no market lines yet; borrow week 11's book.
      expect(linesBook(slates, "w12")).toEqual({ full: "DraftKings", short: "DK" });
      expect(linesBook([{ id: "w12", games: [game("b", -3)] }], "w12")).toBeNull();
    });
  });

  describe("valuePick / valueTier", () => {
    it("states the bet from the value side's own line", () => {
      // Splash PITT -15.5, DK PITT -17.5: DK makes PITT a bigger favourite,
      // so Splash's PITT -15.5 is 2 points cheaper.
      const pick = valuePick(game("g", -15.5, -17.5));
      expect(pick).toMatchObject({ team: { alias: "PITT" }, splash: -15.5, market: -17.5, points: 2, flip: false });
      expect(valueTier(pick)).toBe("best");
    });

    it("reads an away-side edge from the away team's side", () => {
      // Splash PITT -10.5, DK PITT -7.5: FSU +10.5 on Splash vs +7.5.
      expect(valuePick(game("g", -10.5, -7.5))).toMatchObject({ team: { alias: "FSU" }, splash: 10.5, market: 7.5, keyNumbers: [10] });
    });

    it("flags a flipped favourite", () => {
      expect(valuePick(game("g", 1.5, -1.5))).toMatchObject({ flip: true, points: 3 });
    });

    it("counts a key number when the extra points turn a loss into a push or a push into a cover", () => {
      // FSU +3 vs +2: losing by 3 is a push on Splash, a loss at DK.
      expect(valuePick(game("g", -3, -2))!.keyNumbers).toEqual([3]);
      // PITT -2.5 vs -3: winning by 3 covers on Splash, pushes at DK.
      expect(valuePick(game("g", -2.5, -3))!.keyNumbers).toEqual([3]);
      // FSU +6 vs +5 crosses nothing.
      expect(valuePick(game("g", -6, -5))!.keyNumbers).toEqual([]);
    });

    it("tiers 1-1.5 point edges and half points across a key number as small, plain half points as nothing", () => {
      expect(valueTier(valuePick(game("g", -6, -5)))).toBe("small");
      expect(valueTier(valuePick(game("g", -2.5, -3)))).toBe("small");
      // A full point across 7 is best.
      expect(valueTier(valuePick(game("g", -7.5, -6.5)))).toBe("best");
      expect(valueTier(valuePick(game("g", -6, -5.5)))).toBeNull();
      expect(valueTier(valuePick(game("g", -3, -3)))).toBeNull();
      expect(valuePick(game("g", -3))).toBeNull();
    });
  });

  describe("linesSections", () => {
    const now = Date.parse("2026-11-14T12:00:00Z");

    it("splits upcoming games into best, small and other (each in kickoff order), and grades kicked-off value games", () => {
      const games = [
        game("late-even", -3, -3, "2026-11-15T00:00:00Z"),
        game("small", -6, -5, "2026-11-14T20:00:00Z"),
        game("big", -3, 0, "2026-11-14T23:00:00Z"),
        game("early-best", -3, -1, "2026-11-14T13:00:00Z"),
        game("key-half", -2.5, -3, "2026-11-14T19:00:00Z"),
        game("half", -6, -5.5, "2026-11-14T16:00:00Z"),
        game("started", -3, 0, "2026-11-14T11:00:00Z"),
        game("started-even", -3, -3, "2026-11-14T11:30:00Z"),
        game("no-market", -3, undefined, "2026-11-14T18:00:00Z"),
      ];

      const s = linesSections(games, now);
      const ids = (rows: { game: { gameId: string } }[]) => rows.map((r) => r.game.gameId);

      // Kickoff order, not biggest gap first: early-best (2 pts) before big (3).
      expect(ids(s.best)).toEqual(["early-best", "big"]);
      expect(ids(s.small)).toEqual(["key-half", "small"]);
      expect(ids(s.other)).toEqual(["half", "no-market", "late-even"]);
      expect(ids(s.paid)).toEqual(["started"]);
    });
  });

  describe("kickoffDayWord", () => {
    // Local-time dates, so the test holds in any runtime timezone.
    const local = (day: number, hour: number) => new Date(2026, 10, day, hour, 0).toISOString();
    const fri = Date.parse(local(13, 10));
    it("says tonight / today / tomorrow, else the weekday", () => {
      expect(kickoffDayWord(local(13, 19), fri)).toBe("tonight");
      expect(kickoffDayWord(local(13, 12), fri)).toBe("today");
      expect(kickoffDayWord(local(14, 12), fri)).toBe("tomorrow");
      expect(kickoffDayWord(local(17, 12), fri)).toMatch(/^Tue/);
    });
  });

  describe("kickoffDays", () => {
    it("groups rows by calendar day, labelling today and tomorrow", () => {
      const now = Date.parse("2026-11-13T15:00:00Z");
      const rows = [
        { game: game("fri", -3, -3, "2026-11-13T19:00:00Z") },
        { game: game("sat1", -3, -3, "2026-11-14T17:00:00Z") },
        { game: game("sat2", -3, -3, "2026-11-14T20:00:00Z") },
        { game: game("sun", -3, -3, "2026-11-15T17:00:00Z") },
      ];

      const days = kickoffDays(rows, now);

      expect(days.map((d) => d.rows.map((r: { game: { gameId: string } }) => r.game.gameId))).toEqual([["fri"], ["sat1", "sat2"], ["sun"]]);
      expect(days[0].label).toMatch(/^Today · /);
      expect(days[1].label).toMatch(/^Tomorrow · /);
      expect(days[2].label).not.toMatch(/Today|Tomorrow/);
    });
  });

  describe("valueResult / valueTally", () => {
    const finalGame = (home: number | null, away: number | null) => ({
      ...game("g", -3, -4),
      status: "finalized",
      home: { alias: "PITT", name: "Pittsburgh", spread: -3, score: home },
      away: { alias: "FSU", name: "Florida State", spread: 3, score: away },
    });
    const row = (g: ReturnType<typeof finalGame>) => ({ game: g, pick: valuePick(g) });

    it("grades the value side at Splash's line and notices when the extra points decided it", () => {
      // PITT -3 on Splash (DK -4), wins by 3: push on Splash, a loss at DK.
      expect(valueResult(row(finalGame(24, 21)))).toMatchObject({ tone: "push", label: "Push", final: true, extraPointsMattered: true, atMarket: "lost" });
      // Loses outright: "Didn't cover", not the vaguer "Missed".
      expect(valueResult(row(finalGame(10, 21)))).toMatchObject({ tone: "bad", label: "Didn't cover" });
      // Wins by 9: covers either way.
      expect(valueResult(row(finalGame(30, 21)))).toMatchObject({ tone: "good", label: "Covered", extraPointsMattered: false });
    });

    it("reads a live game as covering or not, never final", () => {
      const live = { ...finalGame(14, 0), status: "in_progress" };
      expect(valueResult(row(live))).toMatchObject({ tone: "good", live: true, label: "Covering", final: false });
    });

    it("groups kicked-off value picks live, final, then waiting", () => {
      const live = { ...finalGame(14, 0), gameId: "live", status: "in_progress" };
      const done = { ...finalGame(30, 21), gameId: "done" };
      const waiting = { ...finalGame(null, null), gameId: "wait", status: "scheduled" };
      const groups = paidGroups([row(done), row(waiting), row(live)]);
      const ids = (rows: { game: { gameId: string } }[]) => rows.map((r) => r.game.gameId);
      expect({ live: ids(groups.live), final: ids(groups.final), waiting: ids(groups.waiting) }).toEqual({ live: ["live"], final: ["done"], waiting: ["wait"] });
    });

    it("tallies finished value picks", () => {
      const rows = [row(finalGame(24, 21)), row(finalGame(30, 21)), row(finalGame(10, 21)), row({ ...finalGame(7, 0), status: "in_progress" })];
      expect(valueTally(rows)).toEqual({ wins: 1, losses: 1, ties: 1, decided: 1 });
    });
  });

  describe("linesWeekState", () => {
    it("counts games still to kick off and finds the next one", () => {
      const now = Date.parse("2026-11-14T12:00:00Z");
      const games = [game("a", -3, -3, "2026-11-14T11:00:00Z"), game("b", -3, -3, "2026-11-14T20:00:00Z"), game("c", -3, -3, "2026-11-14T17:00:00Z")];
      expect(linesWeekState(games, now)).toEqual({ toGo: 2, next: "2026-11-14T17:00:00.000Z" });
      expect(linesWeekState([games[0]], now)).toBeNull();
    });
  });

  describe("defaultLinesSlateId", () => {
    const now = Date.parse("2026-11-16T12:00:00Z");

    it("opens on the first week with a game still to kick off", () => {
      const slates = [
        { id: "w11", games: [game("a", -3, -3, "2026-11-15T00:00:00Z")] },
        { id: "w12", games: [game("b", -3, -3, "2026-11-21T17:00:00Z")] },
      ];
      expect(defaultLinesSlateId(slates, now)).toBe("w12");
    });

    it("falls back to the latest week when everything has kicked off", () => {
      const slates = [{ id: "w11", games: [game("a", -3, -3, "2026-11-15T00:00:00Z")] }];
      expect(defaultLinesSlateId(slates, now)).toBe("w11");
      expect(defaultLinesSlateId([], now)).toBeNull();
    });
  });
});
