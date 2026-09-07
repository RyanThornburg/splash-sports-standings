import { describe, expect, it } from "vitest";
import { toStandingsEntry, type SplashLeaderboardEntry } from "../src/splash";

function leaderboardEntry(overrides: Partial<SplashLeaderboardEntry> = {}): SplashLeaderboardEntry {
  return {
    rank: 1,
    displayRank: "1",
    score: 18,
    user: { handle: "ABRUNE" },
    entry: { id: "entry_1", displayName: null },
    metadata: { record: { wins: 18, losses: 2, ties: null } },
    tiebreaker: { steps: [{ value: "wins", total: 18, submitted: null }] },
    ...overrides,
  };
}

describe("toStandingsEntry", () => {
  it("maps the raw leaderboard fields onto a StandingsEntry", () => {
    const result = toStandingsEntry(leaderboardEntry());

    expect(result).toEqual({
      rank: 1,
      displayRank: "1",
      entryId: "entry_1",
      handle: "ABRUNE",
      displayName: null,
      score: 18,
      wins: 18,
      losses: 2,
      ties: null,
      tiebreakerDiff: null,
      pending: null,
    });
  });

  it("computes tiebreakerDiff as |total - submitted| once both are known", () => {
    const entry = leaderboardEntry({
      tiebreaker: { steps: [{ value: "last_game_total", total: 45, submitted: 51 }] },
    });

    expect(toStandingsEntry(entry).tiebreakerDiff).toBe(6);
  });

  it("leaves tiebreakerDiff null while the tiebreaker game is undecided", () => {
    const entry = leaderboardEntry({
      tiebreaker: { steps: [{ value: "last_game_total", total: null, submitted: 51 }] },
    });

    expect(toStandingsEntry(entry).tiebreakerDiff).toBeNull();
  });

  it("leaves tiebreakerDiff null when the user hasn't submitted a guess", () => {
    const entry = leaderboardEntry({
      tiebreaker: { steps: [{ value: "last_game_total", total: 45, submitted: null }] },
    });

    expect(toStandingsEntry(entry).tiebreakerDiff).toBeNull();
  });

  it("leaves tiebreakerDiff null when there's no last_game_total step at all", () => {
    const entry = leaderboardEntry({ tiebreaker: { steps: [{ value: "wins", total: 18, submitted: null }] } });

    expect(toStandingsEntry(entry).tiebreakerDiff).toBeNull();
  });
});
