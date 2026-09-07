// Pure logic shared by app.js, extracted into its own module so it can be
// unit tested directly (see test/lib.test.ts) without a DOM. Everything here
// takes plain data in and returns plain data out — no globals, no fetch, no
// document/localStorage access.

export function recordText(entry) {
  return `${entry.wins}-${entry.losses}${entry.ties ? `-${entry.ties}` : ""}`;
}

export function winPct(entry) {
  const decided = entry.wins + entry.losses;
  if (decided === 0) return "-";
  return `${Math.round((entry.wins / decided) * 100)}%`;
}

// Ranks the already globally-sorted, pre-filtered entries 1..N among
// themselves, marking ties (equal score) the same way the site's own
// displayRank does.
export function withGroupRank(entries) {
  let rank = 0;
  let lastScore = null;
  const withRank = entries.map((entry, i) => {
    if (entry.score !== lastScore) {
      rank = i + 1;
      lastScore = entry.score;
    }
    return { entry, groupRank: rank };
  });

  for (let i = 0; i < withRank.length; i++) {
    const tied = withRank.filter((r) => r.groupRank === withRank[i].groupRank).length > 1;
    withRank[i].groupRankLabel = tied ? `T${withRank[i].groupRank}` : String(withRank[i].groupRank);
  }
  return withRank;
}

// How many of this week's required picks are still undecided. Mirrors
// src/picks.ts's computePendingCount exactly (same week.wins/losses/ties
// approach, not pick-grade counting) — see that function's doc comment for
// why counting grades ourselves is the wrong move. Duplicated here rather
// than shared because the frontend and the Worker are separate runtimes with
// no shared module boundary today.
export function computeWeeklyPending(week, picksRequiredCount) {
  const decided = week.wins + week.losses + (week.ties ?? 0);
  return picksRequiredCount - decided;
}

// Splash uses more than one terminal status ("finalized" and "finished" both
// seen for completed games) — anything not in this set and not "scheduled"
// is treated as live.
export const FINISHED_STATUSES = new Set(["finalized", "finished"]);

export function isLiveGame(game) {
  return Boolean(game) && game.status !== "scheduled" && !FINISHED_STATUSES.has(game.status);
}

// Matchup line with the home team's own spread folded in ("UCLA @ CAL
// (+1.5)") instead of a separate row, plus — once the game has started — a
// second line with just the score, and a third with quarter/clock if live.
export function gameHeaderLines(game) {
  const spread = game.home.spread;
  const spreadText = spread > 0 ? `+${spread}` : `${spread}`;
  const matchup = `${game.away.alias} @ ${game.home.alias} (${spreadText})`;

  if (game.status === "scheduled") {
    return { matchup, detail: null, live: false, clock: null };
  }
  const finished = FINISHED_STATUSES.has(game.status);
  const detail = `${finished ? "F" : "LIVE"} ${game.away.score ?? "-"}-${game.home.score ?? "-"}`;
  const clock = game.state ? `Q${game.state.quarter} ${game.state.clock}` : null;
  return { matchup, detail, live: !finished, clock };
}

// For an ungraded pick on a live game, is it currently covering the spread
// it was picked at? Uses the same (score margin + spread) math the eventual
// `grade` is based on, just computed live against the current score instead
// of the final one.
function livePickClass(pick, game) {
  if (!isLiveGame(game) || game.home.score == null || game.away.score == null) {
    return "pick-pending";
  }
  const pickIsHome = pick.team.alias === game.home.alias;
  const pickScore = pickIsHome ? game.home.score : game.away.score;
  const oppScore = pickIsHome ? game.away.score : game.home.score;
  const coverMargin = pickScore - oppScore + pick.spread;
  if (coverMargin > 0) return "pick-live-winning";
  if (coverMargin < 0) return "pick-live-losing";
  return "pick-live-tied";
}

// Prefers Splash's own grade when it tells us anything ("won"/"lost"/"push"
// are final; "winning"/"losing" are its own live read, seen on any
// in-progress game, not just the tiebreaker) and only falls back to our own
// score-based guess (livePickClass) when grade is null — a live game Splash
// hasn't graded yet.
export function pickCellClass(pick, game) {
  switch (pick.grade) {
    case "won":
      return "pick-won";
    case "lost":
      return "pick-lost";
    case "push":
      return "pick-push";
    case "winning":
      return "pick-live-winning";
    case "losing":
      return "pick-live-losing";
    default:
      return livePickClass(pick, game);
  }
}

// Live games first (so what's happening right now is immediately visible),
// then chronological by kickoff, falling back to home team name for any tie
// (e.g. a full slate of early-window games starting simultaneously).
export function sortGameIds(gameIds, gamesById) {
  return [...gameIds].sort((a, b) => {
    const gameA = gamesById.get(a);
    const gameB = gamesById.get(b);
    const liveA = isLiveGame(gameA);
    const liveB = isLiveGame(gameB);
    if (liveA !== liveB) return liveA ? -1 : 1;
    if (!gameA || !gameB) return 0;
    const timeDiff = new Date(gameA.startsAt) - new Date(gameB.startsAt);
    return timeDiff !== 0 ? timeDiff : gameA.home.alias.localeCompare(gameB.home.alias);
  });
}
