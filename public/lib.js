// Pure logic shared by app.js, extracted into its own module so it can be
// unit tested directly (see test/lib.test.ts) without a DOM. Everything here
// takes plain data in and returns plain data out,no globals, no fetch, no
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
// themselves. Entries only share a rank (marked with a "T" prefix) when
// score AND tiebreakerDiff both match
export function withGroupRank(entries) {
  let rank = 0;
  let lastKey = null;
  const withRank = entries.map((entry, i) => {
    const key = `${entry.score}:${entry.tiebreakerDiff}`;
    if (key !== lastKey) {
      rank = i + 1;
      lastKey = key;
    }
    return { entry, groupRank: rank };
  });

  for (let i = 0; i < withRank.length; i++) {
    const tied = withRank.filter((r) => r.groupRank === withRank[i].groupRank).length > 1;
    withRank[i].groupRankLabel = tied ? `T${withRank[i].groupRank}` : String(withRank[i].groupRank);
  }
  return withRank;
}

// How many of this week's required picks are still undecided
export function computeWeeklyPending(week) {
  return week.potentialPoints - week.wins;
}

// Splash uses more than one terminal status ("finalized" and "finished" both
// seen for completed games), anything other than this and scheduled is considered live
export const FINISHED_STATUSES = new Set(["finalized", "finished"]);

export function isLiveGame(game) {
  return Boolean(game) && game.status !== "scheduled" && !FINISHED_STATUSES.has(game.status);
}

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

export function coverStatus(teamAlias, spread, game) {
  if (!game || game.status === "scheduled" || game.home.score == null || game.away.score == null) {
    return "pending";
  }
  const isHome = teamAlias === game.home.alias;
  const teamScore = isHome ? game.home.score : game.away.score;
  const oppScore = isHome ? game.away.score : game.home.score;
  const margin = teamScore - oppScore + spread;
  const finished = FINISHED_STATUSES.has(game.status);
  if (margin > 0) return finished ? "won" : "live-winning";
  if (margin < 0) return finished ? "lost" : "live-losing";
  return finished ? "push" : "live-tied";
}

// Take splash grade first and fall back to coverStatus if needed
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
      return `pick-${coverStatus(pick.team.alias, pick.spread, game)}`;
  }
}

// Groups our filtered users' picks by game and surfaces only the
// interesting ones: 
//  a consensus (>= consensusThreshold users on the same team) 
//    or a head-to-head split (our own users on opposite sides of the same game)
// Sorted by how many people on the same side
export function computeGroupTrends(users, gamesById, { consensusThreshold = 3 } = {}) {
  const byGame = new Map();

  for (const [handle, week] of Object.entries(users)) {
    for (const pick of week.picks) {
      let teams = byGame.get(pick.gameId);
      if (!teams) {
        teams = new Map();
        byGame.set(pick.gameId, teams);
      }
      let teamRow = teams.get(pick.team.alias);
      if (!teamRow) {
        teamRow = { team: pick.team, handles: [], pick };
        teams.set(pick.team.alias, teamRow);
      }
      teamRow.handles.push(handle);
    }
  }

  const rows = [];
  for (const [gameId, teams] of byGame) {
    const game = gamesById.get(gameId);
    const teamRows = [...teams.values()]
      .map((t) => ({
        team: t.team,
        handles: t.handles,
        count: t.handles.length,
        statusClass: pickCellClass(t.pick, game),
      }))
      .sort((a, b) => b.count - a.count);
    const maxCount = teamRows[0].count;
    const isSplit = teamRows.length > 1;
    const isConsensus = maxCount >= consensusThreshold;
    if (!isSplit && !isConsensus) continue;
    rows.push({ gameId, teams: teamRows, isConsensus, isSplit, maxCount });
  }

  return rows.sort((a, b) => b.maxCount - a.maxCount);
}

// Top teams by pool-wide pick count for one slate
export function computePoolTopPicks(poolPickCounts, poolEntryCount, gamesById, topX = 10) {
  return [...poolPickCounts]
    .sort((a, b) => b.count - a.count)
    .slice(0, topX)
    .map((p) => {
      const game = gamesById.get(p.gameId);
      const spread = game && p.team.alias === game.home.alias ? game.home.spread : game?.away.spread;
      return {
        ...p,
        pct: poolEntryCount > 0 ? Math.round((p.count / poolEntryCount) * 100) : 0,
        statusClass: pickCellClass({ team: p.team, spread }, game),
      };
    });
}

// Same idea as computePoolTopPicks but summed across every cached slate, 
// by team rather than by game (a team's game/gameId changes week to week, but its alias/name doesn't)
export function computeSeasonPoolTopTeams(slates, topX = 10) {
  const byTeam = new Map();

  for (const slate of slates) {
    for (const p of slate.poolPickCounts ?? []) {
      const existing = byTeam.get(p.team.alias);
      if (existing) {
        existing.count += p.count;
      } else {
        byTeam.set(p.team.alias, { team: p.team, count: p.count });
      }
    }
  }

  return [...byTeam.values()]
    .sort((a, b) => b.count - a.count || a.team.name.localeCompare(b.team.name))
    .slice(0, topX);
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
