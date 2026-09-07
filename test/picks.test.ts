import { describe, expect, it } from "vitest";
import { computePendingCount, computeTeamAggregates, type WeeklyEntryResult, type WeeklyPick } from "../src/picks";

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
  return { wins: 0, losses: 0, ties: null, picks, ...overrides };
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

describe("computePendingCount", () => {
  // Deliberately keyed off week.wins/losses/ties (Splash's own decided-picks
  // count), not off individual pick grades — see the function's doc comment
  // for why. The `picks` array content is irrelevant here by design; these
  // tests intentionally leave it empty.
  it("counts required picks not yet decided", () => {
    const w = week([], { wins: 10, losses: 9 });
    expect(computePendingCount(w, 20)).toBe(1);
  });

  it("is fully pending when nothing has been decided yet", () => {
    expect(computePendingCount(week([]), 20)).toBe(20);
  });

  it("is zero once every required pick is decided", () => {
    const w = week([], { wins: 1, losses: 1 });
    expect(computePendingCount(w, 2)).toBe(0);
  });

  it("counts ties toward decided picks", () => {
    const w = week([], { wins: 9, losses: 9, ties: 1 });
    expect(computePendingCount(w, 20)).toBe(1);
  });

  // Regression: this must stay independent of individual pick grades.
  // Splash has surprised us twice with grade/status strings we hadn't seen
  // ("winning"/"losing" as a live, non-final grade; "finished" as a second
  // terminal game status) — counting grades ourselves caused pending counts
  // to be off by one in production. wins/losses/ties already exclude
  // in-progress picks correctly regardless of what grade string is used.
  it("ignores pick grades entirely, even ones we don't recognize", () => {
    const w = week([pick({ grade: "some-future-grade-value-we-dont-know-about" as never })], {
      wins: 10,
      losses: 9,
    });
    expect(computePendingCount(w, 20)).toBe(1);
  });
});
