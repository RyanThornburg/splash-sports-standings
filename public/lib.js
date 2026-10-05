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

// Orders computeGroupTrends rows so the few worth reading come first, and
// tags each with why it's there:
//   "outnumbered" - `me` is on the smaller side of a split (most first)
//   "lock"        - 4+ of us on one side (biggest first)
//   "split"/"consensus" - everything else, most of us involved first, then
//                         the more even split
// A 1-vs-1 split still counts, it just sorts to the bottom.
export function rankGroupTrends(rows, me = null, { lockThreshold = 4 } = {}) {
  const ranked = rows.map((row) => {
    const mine = me ? row.teams.find((t) => t.handles.includes(me)) : null;
    const others = mine ? row.teams.filter((t) => t !== mine) : [];
    const biggestOther = Math.max(0, ...others.map((t) => t.count));
    let reason;
    let tier;
    if (mine && biggestOther > mine.count) {
      reason = "outnumbered";
      tier = 0;
    } else if (row.maxCount >= lockThreshold) {
      reason = "lock";
      tier = 1;
    } else {
      reason = row.isSplit ? "split" : "consensus";
      tier = 2;
    }
    const involved = row.teams.reduce((n, t) => n + t.count, 0);
    // Smaller side of the game: how many of us are on the other end of the argument.
    const minority = row.teams.length > 1 ? Math.min(...row.teams.map((t) => t.count)) : 0;
    return { ...row, reason, tier, involved, minority, gap: biggestOther - (mine?.count ?? 0) };
  });
  return ranked.sort(
    (a, b) =>
      a.tier - b.tier ||
      (a.tier === 0 ? b.gap - a.gap : 0) ||
      b.involved - a.involved ||
      b.minority - a.minority ||
      b.maxCount - a.maxCount,
  );
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

// ---- Weekly (score-bug view) ----

export function formatSpread(spread) {
  if (spread == null) return "";
  if (spread === 0) return "PK";
  return spread > 0 ? `+${spread}` : `${spread}`;
}

// "Updated 3 min ago" style freshness. Falls back to a clock time past a day.
export function relativeTime(iso, nowMs = Date.now()) {
  if (!iso) return null;
  const diffMin = Math.floor((nowMs - new Date(iso).getTime()) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

// The week Weekly opens on: the latest slate where any of our users actually
// has picks (so between weekends it lands on last week's results rather than
// an empty upcoming slate), falling back to the latest slate at all.
export function defaultSlateId(slates) {
  if (!slates || slates.length === 0) return null;
  for (let i = slates.length - 1; i >= 0; i--) {
    const users = Object.values(slates[i].users ?? {});
    if (users.some((u) => (u.picks ?? []).length > 0)) return slates[i].id;
  }
  return slates[slates.length - 1].id;
}

// This week's standings among our users: most wins first, then fewest
// losses. Users level on both share a rank, labelled "T2" etc.
export function weekStandings(users) {
  const rows = Object.entries(users ?? {}).map(([handle, week]) => ({
    handle,
    wins: week.wins ?? 0,
    losses: week.losses ?? 0,
    ties: week.ties ?? 0,
    pending: computeWeeklyPending(week),
  }));
  rows.sort((a, b) => b.wins - a.wins || a.losses - b.losses || a.handle.localeCompare(b.handle));

  let rank = 0;
  rows.forEach((row, i) => {
    const prev = rows[i - 1];
    if (!prev || prev.wins !== row.wins || prev.losses !== row.losses) rank = i + 1;
    row.rank = rank;
  });
  for (const row of rows) {
    const tied = rows.filter((r) => r.rank === row.rank).length > 1;
    row.rankLabel = tied ? `T${row.rank}` : String(row.rank);
  }
  return rows;
}

// Collapses pickCellClass into what a chip or tile needs to show: a tone
// (good/bad/push/pending), whether the game is still being played, and a
// plain-words label for screen readers and tooltips.
export function pickStatus(pick, game) {
  const cls = pickCellClass(pick, game);
  switch (cls) {
    case "pick-won":
      return { tone: "good", live: false, label: "won" };
    case "pick-lost":
      return { tone: "bad", live: false, label: "lost" };
    case "pick-push":
      return { tone: "push", live: false, label: "push" };
    case "pick-live-winning":
      return { tone: "good", live: true, label: "covering" };
    case "pick-live-losing":
      return { tone: "bad", live: true, label: "not covering" };
    case "pick-live-tied":
      return { tone: "push", live: true, label: "even with the spread" };
    default:
      return { tone: "pending", live: isLiveGame(game), label: "not started" };
  }
}

// gameId -> [{ handle, pick }] across every user, in the users' own order.
export function picksByGame(users) {
  const byGame = new Map();
  for (const [handle, week] of Object.entries(users ?? {})) {
    for (const pick of week.picks ?? []) {
      if (!byGame.has(pick.gameId)) byGame.set(pick.gameId, []);
      byGame.get(pick.gameId).push({ handle, pick });
    }
  }
  return byGame;
}

// Splits the games our users picked into the three Weekly sections:
// live (kickoff order), later (kickoff order) and final (most recent first).
// `onlyHandle` limits it to games that one user picked ("My picks").
export function weeklySections(users, gamesById, onlyHandle = null) {
  const byGame = picksByGame(users);
  const live = [];
  const later = [];
  const final = [];
  for (const [gameId, picks] of byGame) {
    if (onlyHandle && !picks.some((p) => p.handle === onlyHandle)) continue;
    const game = gamesById.get(gameId);
    if (!game) continue;
    if (FINISHED_STATUSES.has(game.status)) final.push(game);
    else if (game.status === "scheduled") later.push(game);
    else live.push(game);
  }
  const byKickoff = (a, b) =>
    new Date(a.startsAt) - new Date(b.startsAt) || a.home.alias.localeCompare(b.home.alias);
  live.sort(byKickoff);
  later.sort(byKickoff);
  final.sort((a, b) => byKickoff(b, a));
  return { live, later, final };
}

// Where a week stands, from the games our users picked, for the line under
// the week label. Plain data; app.js does the date/time formatting.
//   { kind: "live", live, later }        games on right now
//   { kind: "between", later, next }     started, nothing live, more to come
//   { kind: "upcoming", next }           nothing kicked off yet
//   { kind: "final", first, last }       every picked game is done
//   null                                  no picked games
export function weekState(users, gamesById) {
  const { live, later, final } = weeklySections(users, gamesById);
  if (live.length) return { kind: "live", live: live.length, later: later.length };
  if (later.length) {
    const next = later[0].startsAt;
    return final.length ? { kind: "between", later: later.length, next } : { kind: "upcoming", next };
  }
  if (!final.length) return null;
  // final is newest-first
  return { kind: "final", first: final[final.length - 1].startsAt, last: final[0].startsAt };
}

// True while a week is being played: something live, or some games done
// with more still to come. Decides whether the site opens on Weekly.
export function weekInProgress(users, gamesById) {
  const state = weekState(users, gamesById);
  return state?.kind === "live" || state?.kind === "between";
}
