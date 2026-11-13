import {
  computeGroupTrends,
  computePoolTopPicks,
  computeSeasonPoolTopTeams,
  computeWeeklyPending,
  defaultLinesSlateId,
  linesBook,
  defaultSlateId,
  formatSpread,
  gameHeaderLines,
  FINISHED_STATUSES,
  lineText,
  linesSections,
  linesWeekState,
  kickoffDayWord,
  paidGroups,
  kickoffDays,
  pickStatus,
  picksByGame,
  rankGroupTrends,
  recordText,
  relativeTime,
  weekInProgress,
  weekStandings,
  weekState,
  weeklySections,
  valueResult,
  valueTally,
  winPct,
  withGroupRank,
} from "./lib.js";

const POLL_INTERVAL_MS = 60_000;
const SELECTED_USER_STORAGE_KEY = "splash_selected_user";
const ME_STORAGE_KEY = "petz_me";
const MODE_STORAGE_KEY = "petz_weekly_mode";
const TAB_STORAGE_KEY = "petz_tab";
// Stored as "me" when the visitor says they're not one of the six.
const NOT_IN_GROUP = "__none__";
const TRENDS_TOP_X = 10;
// "Our group" shows this many games before "Show all".
const GROUP_TRENDS_SHOWN = 5;

const $ = (id) => document.getElementById(id);

function readStored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private browsing, blocked)
  }
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Small drawn icons, one stroke weight, so pick status never rides on
// colour alone.
const svg = (path, extra = "") =>
  `<svg class="icon" viewBox="0 0 12 12" aria-hidden="true" ${extra}>${path}</svg>`;
const ICON = {
  check: svg('<path d="M2.2 6.4 4.8 9 9.8 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
  x: svg('<path d="M3 3l6 6M9 3 3 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  up: svg('<path d="M6 2.2 10.4 9.6H1.6Z" fill="currentColor"/>'),
  down: svg('<path d="M6 9.8 1.6 2.4h8.8Z" fill="currentColor"/>'),
  dash: svg('<path d="M2.5 6h7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  ring: svg('<circle cx="6" cy="6" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6"/>'),
  trophy: svg(
    '<path d="M3.2 1.4h5.6v3.1a2.8 2.8 0 0 1-5.6 0Z" fill="currentColor"/>' +
      '<path d="M3.2 2.4H1.6v.9a1.9 1.9 0 0 0 1.9 1.9M8.8 2.4h1.6v.9a1.9 1.9 0 0 1-1.9 1.9M6 7.4v2M3.9 10.6h4.2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
  ),
};

// Rank cell for a leader: the trophy stands in for "1" (ties share it).
function trophyRank(label) {
  return `<span class="trophy" title="${esc(label)}">${ICON.trophy}<span class="sr-only">${esc(label)}</span></span>`;
}

function statusIcon(status) {
  if (status.tone === "good") return status.live ? ICON.up : ICON.check;
  if (status.tone === "bad") return status.live ? ICON.down : ICON.x;
  if (status.tone === "push") return ICON.dash;
  return ICON.ring;
}

// ---- Freshness ----

const updatedEl = $("updated");
const staleBanner = $("stale-banner");
let lastUpdated = null;
let lastFetchFailed = false;

function renderUpdated() {
  const ago = relativeTime(lastUpdated);
  updatedEl.textContent = ago ? `Updated ${ago}` : "Not updated yet";
  updatedEl.title = lastUpdated ? new Date(lastUpdated).toLocaleString() : "";
}

function noteUpdated(iso) {
  if (iso && (!lastUpdated || iso > lastUpdated)) lastUpdated = iso;
  renderUpdated();
}

async function pollStatus() {
  let statusOk = true;
  try {
    const res = await fetch("/api/status");
    const status = await res.json();
    statusOk = status.ok !== false;
  } catch (err) {
    console.error("Failed to load status", err);
  }

  const when = lastUpdated ? relativeTime(lastUpdated) : null;
  if (lastFetchFailed) {
    staleBanner.innerHTML = `<strong>Couldn't refresh.</strong> Showing data from ${esc(when ?? "earlier")}. It will try again in a minute.`;
    staleBanner.hidden = false;
  } else if (!statusOk) {
    staleBanner.innerHTML = `<strong>Scores aren't updating.</strong> The last refresh from Splash was ${esc(when ?? "a while ago")}, so live results may be out of date.`;
    staleBanner.hidden = false;
  } else {
    staleBanner.hidden = true;
  }
}

// ---- Overall ----

function renderStandings(data) {
  const table = $("standings");
  const empty = $("standings-empty");
  const tbody = $("standings-body");
  const entries = data.entries ?? [];

  table.hidden = entries.length === 0;
  empty.hidden = entries.length > 0;

  const splashLink = $("splash-link");
  if (data.splashUrl) {
    splashLink.href = data.splashUrl;
    splashLink.hidden = false;
  } else {
    splashLink.hidden = true;
  }

  // The tiebreaker (guess-the-score) has no values until that game is played,
  // so hide it rather than show "-" for everyone all season.
  const hasTiebreak = entries.some((entry) => entry.tiebreakerDiff !== null);
  $("tiebreak-header").hidden = !hasTiebreak;
  // Same for picks left: only meaningful while a week has undecided picks.
  const hasPending = entries.some((entry) => entry.pending != null);
  $("left-header").hidden = !hasPending;

  // The column heads are abbreviations and tooltips don't work on a phone.
  const note = [];
  if (hasPending) note.push("<b>Left</b> picks not decided yet");
  note.push("<b>Pool</b> rank in the whole Splash contest");
  if (hasTiebreak) note.push("<b>TB</b> tiebreaker: how far off your score guess was, lower is better");
  $("standings-note").innerHTML = note.join(" · ");
  $("standings-note").hidden = entries.length === 0;

  const me = readStored(ME_STORAGE_KEY);
  tbody.innerHTML = withGroupRank(entries)
    .map(({ entry, groupRankLabel, groupRank }) => {
      const leader = groupRank === 1 && entry.wins > 0;
      const classes = [leader ? "win" : "", entry.handle === me ? "me" : ""].join(" ").trim();
      const cells = [
        `<td class="rk">${leader ? trophyRank("Season leader") : esc(groupRankLabel)}</td>`,
        `<td class="name">${esc(entry.displayName ?? entry.handle)}</td>`,
        `<td class="rec">${esc(recordText(entry))}</td>`,
        `<td class="num col-num">${esc(winPct(entry))}</td>`,
      ];
      if (hasPending) cells.push(`<td class="num col-num">${esc(entry.pending ?? "-")}</td>`);
      cells.push(`<td class="num col-num">${esc(entry.displayRank)}</td>`);
      if (hasTiebreak) cells.push(`<td class="num col-num">${esc(entry.tiebreakerDiff ?? "-")}</td>`);
      return `<tr${classes ? ` class="${classes}"` : ""}>${cells.join("")}</tr>`;
    })
    .join("");
}

// ---- Weekly ----

let weeklyData = null;
let selectedSlateId = null;

function slates() {
  return weeklyData?.slates ?? [];
}

function currentSlate() {
  return slates().find((s) => s.id === selectedSlateId) ?? null;
}

function getMe(slate) {
  const stored = readStored(ME_STORAGE_KEY);
  if (stored === NOT_IN_GROUP) return null;
  return stored && slate?.users?.[stored] ? stored : null;
}

function getMode() {
  return readStored(MODE_STORAGE_KEY) === "all" ? "all" : "mine";
}

function chip(handle, pick, game, me) {
  const status = pickStatus(pick, game);
  const tone = status.tone === "pending" ? "" : status.tone;
  return `<span class="chip ${tone}${handle === me ? " me" : ""}">${statusIcon(status)}${esc(handle)}<span class="sr-only">, ${esc(status.label)}</span></span>`;
}

function sideChips(picks, alias, game, me) {
  const side = picks
    .filter((p) => p.pick.team.alias === alias)
    .sort((a, b) => (b.handle === me) - (a.handle === me));
  return side.length
    ? `<div class="side">${side.map((p) => chip(p.handle, p.pick, game, me)).join("")}</div>`
    : `<div class="side none">No one</div>`;
}

function teamName(team) {
  const rank = team.top25Ranking ? `<span class="rank">${esc(team.top25Ranking)}</span>` : "";
  return `${rank}<span class="abbr">${esc(team.alias)}</span>`;
}

const gameAnchor = (gameId) => `g-${gameId}`;

// Your side of a game gets a bar under its team cell instead of a separate
// "Your pick" line, so every bug is the same height and two-up rows line up.
const mineClass = (t, myPick) => (myPick?.team.alias === t.alias ? " mine" : "");
const mineLabel = (t, myPick) => (myPick?.team.alias === t.alias ? `<span class="sr-only">, your pick</span>` : "");

function kickoff(game) {
  const d = new Date(game.startsAt);
  return {
    day: d.toLocaleDateString(undefined, { weekday: "short" }),
    time: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
  };
}

function quarterLabel(q) {
  return { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th" }[q] ?? "OT";
}

function scoreBug(game, picks, me, myPick) {
  const scheduled = game.status === "scheduled";
  const team = (t, other) => {
    const trail = !scheduled && t.score != null && other.score != null && t.score < other.score;
    return `<div class="team${trail ? " trail" : ""}${mineClass(t, myPick)}">
      <span>${teamName(t)}${mineLabel(t, myPick)}</span><span class="sprd">${esc(formatSpread(t.spread))}</span>
      <span class="score">${scheduled ? "" : esc(t.score ?? "")}</span></div>`;
  };
  let clock;
  if (scheduled) {
    const k = kickoff(game);
    clock = `<div class="clock sched"><span class="q">${esc(k.day)}</span><span class="t">${esc(k.time)}</span></div>`;
  } else if (game.state) {
    clock = `<div class="clock"><span class="q">${quarterLabel(game.state.quarter)}</span><span class="t">${esc(game.state.clock ?? "")}</span></div>`;
  } else {
    clock = `<div class="clock"><span class="q">Live</span></div>`;
  }
  return `<article class="game" id="${gameAnchor(game.gameId)}" aria-label="${esc(game.away.name)} at ${esc(game.home.name)}">
    <div class="bug">${team(game.away, game.home)}${team(game.home, game.away)}${clock}</div>
    <div class="sides">${sideChips(picks, game.away.alias, game, me)}${sideChips(picks, game.home.alias, game, me)}</div>
  </article>`;
}

function finalRow(game, picks, me, myPick) {
  const ft = (t, o) =>
    `<div class="ft${t.score < o.score ? " lose" : ""}${mineClass(t, myPick)}"><span>${teamName(t)}${mineLabel(t, myPick)} <span class="sprd">${esc(formatSpread(t.spread))}</span></span><span class="score">${esc(t.score ?? "")}</span></div>`;
  const side = (alias) => {
    const list = picks.filter((p) => p.pick.team.alias === alias).sort((a, b) => (b.handle === me) - (a.handle === me));
    return `<div class="side">${list.map((p) => chip(p.handle, p.pick, game, me)).join("")}</div>`;
  };
  return `<div class="frow" id="${gameAnchor(game.gameId)}">
    <div class="fline">${ft(game.away, game.home)}${ft(game.home, game.away)}<span class="ftag">Final</span></div>
    <div class="fchips">${side(game.away.alias)}${side(game.home.alias)}</div>
  </div>`;
}

function renderWhoPicker(slate) {
  const picker = $("who-picker");
  const stored = readStored(ME_STORAGE_KEY);
  const handles = Object.keys(slate?.users ?? {});
  const show = handles.length > 0 && (!stored || (stored !== NOT_IN_GROUP && !slate.users[stored]));
  picker.hidden = !show;
  if (!show) return;
  $("who-options").innerHTML =
    handles.map((h) => `<button type="button" data-handle="${esc(h)}">${esc(h)}</button>`).join("") +
    `<button type="button" class="who-none" data-handle="${NOT_IN_GROUP}">Just looking</button>`;
}

function renderBoard(slate, me) {
  const rows = weekStandings(slate.users);
  const settled = slate.status === "settled" || slate.final === true;
  $("week-board").innerHTML =
    `<div class="head"><span>#</span><span>Name</span><span>W-L</span><span>Left</span></div>` +
    rows
      .map((r) => {
        const isMe = r.handle === me;
        const leader = r.rank === 1 && r.wins > 0;
        const rank = leader ? trophyRank(settled ? "Won the week" : "Leading this week") : esc(r.rankLabel);
        const you = isMe ? `<span class="you">You · <button type="button" id="change-me">Change</button></span>` : "";
        return `<div class="row${isMe ? " me" : ""}${leader ? " win" : ""}"><span class="rk">${rank}</span>
          <span class="name">${esc(r.handle)}${you}</span>
          <span class="rec">${esc(recordText(r))}</span><span class="left">${esc(r.pending)}</span></div>`;
      })
      .join("");
}

function renderYourWeek(slate, gamesById, me) {
  const section = $("your-week");
  section.hidden = !me;
  if (!me) return;

  const week = slate.users[me];
  const picks = [...week.picks].sort((a, b) => {
    const ga = gamesById.get(a.gameId);
    const gb = gamesById.get(b.gameId);
    return new Date(ga?.startsAt ?? 0) - new Date(gb?.startsAt ?? 0);
  });
  const statuses = picks.map((p) => ({ pick: p, status: pickStatus(p, gamesById.get(p.gameId)) }));
  const liveUp = statuses.filter((s) => s.status.live && s.status.tone === "good").length;
  const liveDown = statuses.filter((s) => s.status.live && s.status.tone === "bad").length;
  const left = computeWeeklyPending(week);

  $("yw-stats").innerHTML =
    `<span class="stat"><b>${esc(recordText(week))}</b>W-L</span>` +
    (liveUp + liveDown > 0
      ? `<span class="stat"><b class="up">${ICON.up}${liveUp}</b><b class="down">${ICON.down}${liveDown}</b>Live</span>`
      : "") +
    `<span class="stat"><b>${esc(left)}</b>Left</span>`;

  $("yw-tiles").innerHTML = statuses
    .map(({ pick, status }) => {
      const cls = [status.tone, status.live ? "live" : ""].join(" ");
      return `<a class="tile ${cls}" href="#${gameAnchor(pick.gameId)}" aria-label="${esc(pick.team.alias)} ${esc(formatSpread(pick.spread))}, ${esc(status.label)}">
        ${statusIcon(status)}<span class="a">${esc(pick.team.alias)}</span></a>`;
    })
    .join("");

  $("yw-key").innerHTML =
    `<span>${ICON.check}won</span><span>${ICON.x}lost</span>` +
    `<span>${ICON.up}covering</span><span>${ICON.down}not covering</span><span>${ICON.ring}not started</span>`;
}

// Finals collapse while anything is live or still to come; this remembers
// a tap to open them across the 60s re-renders.
let finalsOpen = false;

function renderGames(slate, gamesById, me) {
  const mode = me ? getMode() : "all";
  const segwrap = $("segwrap");
  segwrap.hidden = !me;

  const byGame = picksByGame(slate.users);
  const all = weeklySections(slate.users, gamesById);
  const shown = mode === "mine" ? weeklySections(slate.users, gamesById, me) : all;

  if (me) {
    const allCount = all.live.length + all.later.length + all.final.length;
    $("seg-mine").innerHTML = `My picks <span class="n">(${slate.users[me].picks.length})</span>`;
    $("seg-all").innerHTML = `All games <span class="n">(${allCount})</span>`;
    for (const b of segwrap.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
  }

  const myPickFor = (gameId) => (me ? byGame.get(gameId)?.find((p) => p.handle === me)?.pick : null);
  const fill = (key, games, render) => {
    $(`sec-${key}`).hidden = games.length === 0;
    $(`count-${key}`).textContent = games.length;
    $(`games-${key}`).innerHTML = games
      .map((g) => render(g, byGame.get(g.gameId) ?? [], me, myPickFor(g.gameId)))
      .join("");
  };
  fill("live", shown.live, scoreBug);
  fill("later", shown.later, scoreBug);
  fill("final", shown.final, finalRow);

  let record = "";
  if (me && mode === "mine" && shown.final.length) {
    const tones = shown.final.map((g) => pickStatus(byGame.get(g.gameId).find((p) => p.handle === me).pick, g).tone);
    const count = (t) => tones.filter((x) => x === t).length;
    record = `· You ${recordText({ wins: count("good"), losses: count("bad"), ties: count("push") })}`;
  }
  $("final-record").textContent = record;

  const collapsible = shown.live.length + shown.later.length > 0 && shown.final.length > 0;
  const open = !collapsible || finalsOpen;
  $("games-final").hidden = !open;
  const toggle = $("final-toggle");
  toggle.hidden = !collapsible;
  toggle.setAttribute("aria-expanded", String(open));
  toggle.textContent = open ? "Hide final games" : `Show ${shown.final.length} final ${shown.final.length === 1 ? "game" : "games"}`;
}

$("final-toggle").addEventListener("click", () => {
  finalsOpen = !finalsOpen;
  renderWeekly();
});

// "Final · Sep 27–29", "3 live · 9 later", "Starts Sat 12:00 PM"...
function weekStateText(state) {
  if (!state) return "";
  const when = (iso) => {
    const k = kickoff({ startsAt: iso });
    return `${k.day} ${k.time}`;
  };
  if (state.kind === "live") return `${state.live} live${state.later ? ` · ${state.later} later` : ""}`;
  if (state.kind === "between") return `${state.later} to go · next ${when(state.next)}`;
  if (state.kind === "upcoming") return `Starts ${when(state.next)}`;
  const a = new Date(state.first);
  const b = new Date(state.last);
  const md = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  let range = md(a);
  if (md(a) !== md(b)) {
    range = a.getMonth() === b.getMonth() ? `${md(a)}–${b.getDate()}` : `${md(a)} – ${md(b)}`;
  }
  return `Final · ${range}`;
}

function renderWeekly() {
  const list = slates();
  if (!list.some((s) => s.id === selectedSlateId)) selectedSlateId = defaultSlateId(list);
  const slate = currentSlate();
  const index = list.findIndex((s) => s.id === selectedSlateId);

  $("week-label").textContent = slate ? slate.name : "No weeks yet";
  $("week-state").textContent = "";
  $("week-prev").disabled = index <= 0;
  $("week-next").disabled = index < 0 || index >= list.length - 1;

  const hasPicks = Boolean(slate) && Object.values(slate.users ?? {}).some((u) => u.picks.length > 0);
  $("weekly-empty").hidden = hasPicks;
  $("weekly-body").hidden = !hasPicks;
  renderWhoPicker(hasPicks ? slate : null);
  if (!hasPicks) return;

  const gamesById = new Map((slate.games ?? []).map((g) => [g.gameId, g]));
  $("week-state").textContent = weekStateText(weekState(slate.users, gamesById));
  const me = getMe(slate);
  renderBoard(slate, me);
  renderYourWeek(slate, gamesById, me);
  renderGames(slate, gamesById, me);
}

$("week-prev").addEventListener("click", () => {
  const list = slates();
  const i = list.findIndex((s) => s.id === selectedSlateId);
  if (i > 0) selectedSlateId = list[i - 1].id;
  finalsOpen = false;
  renderWeekly();
});

$("week-next").addEventListener("click", () => {
  const list = slates();
  const i = list.findIndex((s) => s.id === selectedSlateId);
  if (i >= 0 && i < list.length - 1) selectedSlateId = list[i + 1].id;
  finalsOpen = false;
  renderWeekly();
});

$("who-options").addEventListener("click", (e) => {
  const button = e.target.closest("button[data-handle]");
  if (!button) return;
  writeStored(ME_STORAGE_KEY, button.dataset.handle);
  renderWeekly();
});

$("week-board").addEventListener("click", (e) => {
  if (!e.target.closest("#change-me")) return;
  writeStored(ME_STORAGE_KEY, "");
  renderWeekly();
  $("who-picker").scrollIntoView({ block: "nearest" });
});

$("segwrap").addEventListener("click", (e) => {
  const button = e.target.closest("button[data-mode]");
  if (!button) return;
  writeStored(MODE_STORAGE_KEY, button.dataset.mode);
  renderWeekly();
});

// ---- Team Picks ----

function renderAggregatesUser(byHandle, handle) {
  const container = $("aggregates-content");
  const empty = $("aggregates-empty");
  const stats = byHandle[handle];
  empty.hidden = Boolean(stats && stats.length > 0);
  if (!stats || stats.length === 0) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = `<table class="board-table">
    <thead><tr><th>Team</th><th class="col-num">Picks</th><th class="col-num">Record</th></tr></thead>
    <tbody>${stats
      .map(
        (s) =>
          `<tr><td>${esc(s.teamName)}</td><td class="num col-num">${esc(s.picks)}</td><td class="rec col-num">${esc(`${s.wins}-${s.losses}`)}</td></tr>`,
      )
      .join("")}</tbody></table>`;
}

function populateAggregatesSelect(data) {
  const select = $("aggregates-select");
  const handles = Object.keys(data.byHandle ?? {}).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
  const me = readStored(ME_STORAGE_KEY);
  const previousValue =
    select.value || (me && me !== NOT_IN_GROUP ? me : null) || readStored(SELECTED_USER_STORAGE_KEY);

  select.innerHTML = handles.map((h) => `<option value="${esc(h)}">${esc(h)}</option>`).join("");
  if (handles.length === 0) return;
  select.value = handles.includes(previousValue) ? previousValue : handles[0];
}

let aggregatesData = null;

$("aggregates-select").addEventListener("change", (e) => {
  writeStored(SELECTED_USER_STORAGE_KEY, e.target.value);
  renderAggregatesUser(aggregatesData?.byHandle ?? {}, e.target.value);
});

// ---- Trends ----

// pickCellClass's "pick-*" classes collapse to three read-at-a-glance
// states: covering/won (good), not covering/lost (bad), or too early to say.
const TREND_STATUS = {
  "pick-won": { icon: ICON.check, tone: "good" },
  "pick-live-winning": { icon: ICON.up, tone: "good" },
  "pick-lost": { icon: ICON.x, tone: "bad" },
  "pick-live-losing": { icon: ICON.down, tone: "bad" },
  "pick-push": { icon: ICON.dash, tone: "neutral" },
  "pick-live-tied": { icon: ICON.dash, tone: "neutral" },
  "pick-pending": { icon: ICON.ring, tone: "neutral" },
};

function trendStatusIcon(statusClass) {
  const { icon, tone } = TREND_STATUS[statusClass] ?? TREND_STATUS["pick-pending"];
  const span = document.createElement("span");
  span.className = `trend-status trend-status-${tone}`;
  span.innerHTML = icon;
  return span;
}

function populateWeekSelect(select, data) {
  const list = data.slates ?? [];
  const previousValue = select.value;
  select.innerHTML = list
    .map((s) => `<option value="${esc(s.id)}">${esc(s.name)}${s.isCurrentSlate ? " (current)" : ""}</option>`)
    .join("");
  if (list.length === 0) return;
  select.value = list.some((s) => s.id === previousValue) ? previousValue : defaultSlateId(list);
}

const TREND_REASON = {
  outnumbered: "You're outnumbered",
  lock: "Group lock",
  split: "Split",
  consensus: "Agree",
};

// Per week, so 60s polls don't re-collapse a list you opened.
let groupTrendsShowAllFor = null;

function renderGroupTrends(slate) {
  const container = $("trends-group-content");
  const empty = $("trends-group-empty");
  const more = $("trends-more");
  container.innerHTML = "";
  more.hidden = true;

  if (!slate) {
    empty.hidden = false;
    return;
  }

  const gamesById = new Map((slate.games ?? []).map((g) => [g.gameId, g]));
  const trends = rankGroupTrends(computeGroupTrends(slate.users ?? {}, gamesById), getMe(slate));

  empty.hidden = trends.length > 0;
  if (trends.length === 0) return;

  const showAll = groupTrendsShowAllFor === slate.id || trends.length <= GROUP_TRENDS_SHOWN + 1;
  if (trends.length > GROUP_TRENDS_SHOWN + 1) {
    more.hidden = false;
    more.setAttribute("aria-expanded", String(showAll));
    more.textContent = showAll ? `Show top ${GROUP_TRENDS_SHOWN}` : `Show all ${trends.length} games`;
    more.dataset.slate = slate.id;
  }

  for (const row of showAll ? trends : trends.slice(0, GROUP_TRENDS_SHOWN)) {
    const game = gamesById.get(row.gameId);
    const matchup = game ? gameHeaderLines(game).matchup : "?";

    const wrapper = document.createElement("div");
    wrapper.className = "trend-row";

    const matchupEl = document.createElement("div");
    matchupEl.className = "trend-matchup";
    const matchupText = document.createElement("span");
    matchupText.textContent = matchup;
    const reasonEl = document.createElement("span");
    reasonEl.className = `trend-reason${row.reason === "outnumbered" ? " you" : ""}`;
    reasonEl.textContent = TREND_REASON[row.reason];
    matchupEl.append(matchupText, reasonEl);
    wrapper.appendChild(matchupEl);

    const labels = document.createElement("div");
    labels.className = "trend-labels";
    const bar = document.createElement("div");
    bar.className = "trend-bar";
    const handlesRow = document.createElement("div");
    handlesRow.className = "trend-handles-row";

    for (const t of row.teams) {
      const flexShare = `${t.count} 1 0%`;
      const tone = (TREND_STATUS[t.statusClass] ?? TREND_STATUS["pick-pending"]).tone;

      const label = document.createElement("div");
      label.className = "trend-label";
      label.style.flex = flexShare;
      label.appendChild(trendStatusIcon(t.statusClass));
      const aliasSpan = document.createElement("span");
      aliasSpan.textContent = `${t.team.alias} ${t.count}`;
      label.appendChild(aliasSpan);
      labels.appendChild(label);

      const segment = document.createElement("div");
      segment.className = `trend-segment trend-segment-${tone}`;
      segment.style.flex = flexShare;
      bar.appendChild(segment);

      const handlesCell = document.createElement("div");
      handlesCell.className = "trend-handles-cell";
      handlesCell.style.flex = flexShare;
      handlesCell.textContent = t.handles.join(", ");
      handlesRow.appendChild(handlesCell);
    }

    wrapper.appendChild(labels);
    wrapper.appendChild(bar);
    wrapper.appendChild(handlesRow);
    container.appendChild(wrapper);
  }
}

function renderPickMeterList(container, rows, { showStatus }) {
  for (const row of rows) {
    const item = document.createElement("div");
    item.className = "meter-row";

    const top = document.createElement("div");
    top.className = "meter-top";

    const label = document.createElement("span");
    label.className = "meter-label";
    if (showStatus) label.appendChild(trendStatusIcon(row.statusClass));
    const teamSpan = document.createElement("span");
    teamSpan.className = "meter-team";
    teamSpan.textContent = row.team.name;
    label.appendChild(teamSpan);
    if (row.matchup) {
      const gameSpan = document.createElement("span");
      gameSpan.className = "meter-game";
      gameSpan.textContent = row.matchup;
      label.appendChild(gameSpan);
    }
    top.appendChild(label);

    const value = document.createElement("span");
    value.className = "meter-value";
    value.textContent = row.valueText;
    top.appendChild(value);

    item.appendChild(top);

    const track = document.createElement("div");
    track.className = "meter-track";
    const fill = document.createElement("div");
    fill.className = "meter-fill";
    fill.style.width = `${row.pct}%`;
    track.appendChild(fill);
    item.appendChild(track);

    container.appendChild(item);
  }
}

// Top picks across the WHOLE contest (not just our filtered users)
function renderPoolWeekTrends(slate) {
  const container = $("trends-pool-week-content");
  const empty = $("trends-pool-week-empty");
  container.innerHTML = "";

  const poolPickCounts = slate?.poolPickCounts ?? [];
  if (poolPickCounts.length === 0) {
    empty.hidden = false;
    return;
  }

  const gamesById = new Map((slate.games ?? []).map((g) => [g.gameId, g]));
  const poolEntryCount = slate.poolEntryCount ?? 0;
  const topPicks = computePoolTopPicks(poolPickCounts, poolEntryCount, gamesById, TRENDS_TOP_X);

  empty.hidden = topPicks.length > 0;
  if (topPicks.length === 0) return;

  const rows = topPicks.map((p) => {
    const game = gamesById.get(p.gameId);
    return {
      team: p.team,
      matchup: game ? gameHeaderLines(game).matchup : null,
      pct: p.pct,
      valueText: `${p.count} of ${poolEntryCount} · ${p.pct}%`,
      statusClass: p.statusClass,
    };
  });
  renderPickMeterList(container, rows, { showStatus: true });
}

// Same idea, summed across every cached week so far this season
function renderPoolSeasonTrends(data) {
  const container = $("trends-pool-season-content");
  const empty = $("trends-pool-season-empty");
  container.innerHTML = "";

  const topTeams = computeSeasonPoolTopTeams(data?.slates ?? [], TRENDS_TOP_X);
  empty.hidden = topTeams.length > 0;
  if (topTeams.length === 0) return;

  const maxCount = topTeams[0].count;
  const rows = topTeams.map((t) => ({
    team: t.team,
    matchup: null,
    pct: maxCount > 0 ? Math.round((t.count / maxCount) * 100) : 0,
    valueText: `${t.count} picks`,
  }));
  renderPickMeterList(container, rows, { showStatus: false });
}

function renderTrends() {
  const select = $("trends-select");
  populateWeekSelect(select, weeklyData ?? {});
  const slate = slates().find((s) => s.id === select.value);
  renderGroupTrends(slate);
  renderPoolWeekTrends(slate);
  renderPoolSeasonTrends(weeklyData);
}

$("trends-more").addEventListener("click", (e) => {
  const id = e.currentTarget.dataset.slate;
  groupTrendsShowAllFor = groupTrendsShowAllFor === id ? null : id;
  renderGroupTrends(slates().find((s) => s.id === $("trends-select").value));
});

$("trends-select").addEventListener("change", (e) => {
  const slate = slates().find((s) => s.id === e.target.value);
  renderGroupTrends(slate);
  renderPoolWeekTrends(slate);
});

// ---- Lines ----

let linesData = null;
let linesSlateId = null;
// "Other games" folds away while there's value to look at; this remembers a
// tap to open it, per week, across the 60s re-renders.
let linesOtherOpenFor = null;

// When no week has a named book yet (nothing posted by ESPN at all).
const NO_BOOK = { full: "the market", short: "Market" };

const noValue = `<span class="ln-none">–</span>`;

// Opening numbers only show from 600px up (.ln-open-row), labelled. ESPN's
// "open" is often a lookahead line from weeks earlier: context, not a price.
const openSub = (text) => `<span class="ln-sub ln-open-row">open ${esc(text)}</span>`;

function marketSpreadCell(game) {
  const m = game.market;
  const now = lineText(m?.spread);
  if (now == null) return `<td class="ln">${noValue}<span class="sr-only">, not posted yet</span></td>`;
  const open = m.spreadOpen != null && m.spreadOpen !== m.spread ? openSub(lineText(m.spreadOpen)) : "";
  return `<td class="ln">${esc(now)}${open}</td>`;
}

function totalCell(game) {
  const m = game.market;
  if (m?.total == null) return `<td class="ln col-ou">${noValue}</td>`;
  const open = m.totalOpen != null && m.totalOpen !== m.total ? openSub(String(m.totalOpen)) : "";
  return `<td class="ln col-ou">${esc(m.total)}${open}</td>`;
}

// The bet itself: the value side at Splash's line ("ALA −15.5"), how much
// better that is than the market ("2 pts better"; the user found "vs DK
// −17.5, 2 pts better" too wordy, since the DK column is right there), and
// why it's worth a look. `graded` switches to past tense for "Did value pay?".
function valueCell(pick, tier, book, { graded = false } = {}) {
  if (!pick) return `<td class="ln">${noValue}</td>`;
  const tags = [];
  if (pick.flip) tags.push(`Favorite at ${book.short}`);
  for (const k of pick.keyNumbers) tags.push(`Crosses ${k}`);
  // The edge size ranks one row against another, so it gets its own role:
  // the number in the numeral voice, the words a step quieter.
  const unit = pick.points === 1 ? "pt" : "pts";
  return `<td class="ln ln-value"><span class="edge${tier ? ` ${tier}` : ""}">${esc(pick.team.alias)} ${esc(lineText(pick.splash))}</span>
    <span class="ln-edge">${graded ? "was " : ""}<b>${esc(pick.points)}</b> ${unit} better<span class="sr-only"> than ${esc(possessive(book.full))} ${esc(lineText(pick.market))}</span></span>
    ${tags.length ? `<span class="ln-tags">${tags.map((t) => `<span class="ln-tag">${esc(t)}</span>`).join("")}</span>` : ""}</td>`;
}

// `subHtml` is already escaped (the paid table puts an amber quarter in it).
function gameCell(game, subHtml) {
  return `<td class="ln-game"><span class="ln-match">${esc(game.away.alias)} @ ${esc(game.home.alias)}</span><span class="ln-sub">${subHtml}</span></td>`;
}

// One tbody per kickoff day, led by a divider row ("Today · Fri Nov 13"),
// so rows only need the time.
function linesTable(rows, book) {
  const head = `<thead><tr><th>Game</th><th>Splash</th><th>${esc(book.short)}</th><th>Value</th><th class="col-ou">O/U</th></tr></thead>`;
  const days = kickoffDays(rows)
    .map((day) => {
      const body = day.rows
        .map(({ game, pick, tier }) => `<tr>${gameCell(game, esc(kickoff(game).time))}
          <td class="ln"><span class="ln-team">${esc(game.home.alias)}</span> ${esc(lineText(game.home.spread))}</td>
          ${marketSpreadCell(game)}${valueCell(pick, tier, book)}${totalCell(game)}</tr>`)
        .join("");
      return `<tbody><tr class="ln-day"><th colspan="5" scope="rowgroup">${esc(day.label)}</th></tr>${body}</tbody>`;
    })
    .join("");
  return `<table class="board-table lines-table">${head}${days}</table>`;
}

// Escaped HTML for the game cell's second line. A live game's quarter is
// amber, as on Weekly's score bugs (amber is "now").
function paidScore(game) {
  const score = `<span class="ln-score">${esc(`${game.away.score ?? 0}–${game.home.score ?? 0}`)}</span>`;
  if (FINISHED_STATUSES.has(game.status)) return `Final ${score}`;
  // Quarter and clock, as Weekly's bugs show them: "3rd 8:12 · 10–17".
  if (game.state) {
    const clock = game.state.clock ? ` ${esc(game.state.clock)}` : "";
    return `<span class="ln-live">${esc(quarterLabel(game.state.quarter))}${clock}</span> · ${score}`;
  }
  if (game.status === "in_progress") return `<span class="ln-live">Live</span> ${score}`;
  return esc(`Kicked off ${kickoff(game).time}`);
}

const PAID_GROUPS = [
  ["live", `<span class="livedot" aria-hidden="true"></span>Live`],
  ["final", "Final"],
  ["waiting", "Waiting for a score"],
];

// "Did value pay?": each value pick that's kicked off, graded at Splash's
// line (pick status, so green/red with the drawn icons is earned here),
// grouped Live / Final / Waiting under divider rows like the day dividers.
function paidTable(rows, book) {
  const groups = paidGroups(rows);
  const row = (r) => {
    const result = valueResult(r);
    const tone = result.tone === "pending" ? "" : result.tone;
    const why = result.extraPointsMattered
      ? `<span class="ln-sub">${esc(book.short)} ${esc(lineText(r.pick.market))} would've ${result.atMarket === "push" ? "pushed" : "lost"}</span>`
      : "";
    return `<tr>${gameCell(r.game, paidScore(r.game))}${valueCell(r.pick, r.tier, book, { graded: true })}
      <td class="ln"><span class="res ${tone}">${statusIcon(result)}${esc(result.label)}</span>${why}</td></tr>`;
  };
  const bodies = PAID_GROUPS.filter(([key]) => groups[key].length)
    .map(([key, label]) => `<tbody><tr class="ln-day"><th colspan="3" scope="rowgroup">${label}</th></tr>${groups[key].map(row).join("")}</tbody>`)
    .join("");
  return `<table class="board-table lines-table paid-table"><thead><tr><th>Game</th><th>Value</th><th>Result</th></tr></thead>${bodies}</table>`;
}

// Game day: the "did value pay?" answer up top, linking down to the
// details, so the tab's payoff isn't buried under the games still to pick.
function renderLinesStrip(paidRows, tally) {
  const strip = $("lines-strip");
  strip.hidden = paidRows.length === 0;
  if (!paidRows.length) return;
  const { live, waiting } = paidGroups(paidRows);
  const graded = tally.wins + tally.losses + tally.ties;
  // Each phrase stays whole (the live dot with its count). "Extra points
  // decided" is desktop-only: on a phone the strip stays one line, and the
  // sentence under the results table says it.
  const parts = [];
  if (graded) parts.push(`<b>${esc(recordText(tally))}</b>`);
  if (tally.decided) parts.push(`<span class="ls-wide">extra points decided ${tally.decided}</span>`);
  if (live.length) parts.push(`<span class="livedot" aria-hidden="true"></span>${live.length} live`);
  if (!graded && !live.length) parts.push(`${waiting.length} kicked off`);
  const joined = parts.map((p, i) => `<span class="ls-part${p.includes("ls-wide") ? " ls-wide" : ""}">${i ? '<span class="ls-sep">·</span>' : ""}${p}</span>`).join("");
  strip.innerHTML =
    `<span class="ls-label">Value sides</span><span class="ls-parts">${joined}</span>` +
    // A jump, not an accordion: say where it goes ("Results ↓") rather than
    // a bare chevron that promised to expand in place.
    `<span class="ls-go">Results<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg></span>`;
}

function linesSlates() {
  return linesData?.slates ?? [];
}

// "59 games left · next kickoff tonight 7:00 PM", as escaped HTML: each
// phrase is unbreakable, so a phone wraps between them, never "7:00 / PM".
function linesWeekStateHtml(state, games) {
  if (!state) return games.length ? "All kicked off" : "";
  const left = `${state.toGo} ${state.toGo === 1 ? "game" : "games"} left`;
  const next = `next kickoff ${kickoffDayWord(state.next)} ${kickoff({ startsAt: state.next }).time}`;
  return `<span class="ws-part">${esc(left)} ·</span> <span class="ws-part">${esc(next)}</span>`;
}

// "DraftKings'" not "DraftKings's".
const possessive = (name) => (name.endsWith("s") ? `${name}'` : `${name}'s`);

function renderLines() {
  const data = linesData ?? {};
  const list = linesSlates();
  if (!list.some((s) => s.id === linesSlateId)) linesSlateId = defaultLinesSlateId(list);
  const index = list.findIndex((s) => s.id === linesSlateId);
  const slate = list[index] ?? null;
  const allGames = slate?.games ?? [];
  const games = allGames.filter((g) => g.home.spread != null);

  $("lines-label").textContent = slate ? slate.name : "No weeks yet";
  // Before Splash posts any lines, the state line still gives the schedule
  // (the body says the lines aren't posted).
  const scheduled = games.length ? games : allGames;
  $("lines-state").innerHTML = linesWeekStateHtml(linesWeekState(scheduled), scheduled);
  $("lines-prev").disabled = index <= 0;
  $("lines-next").disabled = index < 0 || index >= list.length - 1;

  const hasLines = games.length > 0;
  $("lines-empty").hidden = hasLines;
  $("lines-note").hidden = !hasLines;
  const error = $("lines-error");
  error.hidden = !data.marketError;
  error.textContent = data.marketError
    ? "Couldn't reach ESPN on the last check, so DK lines may be out of date. It checks again every 5 minutes."
    : "";

  const named = linesBook(list, linesSlateId);
  const book = named ?? NO_BOOK;
  const sections = linesSections(games);

  // Freshness and what the columns mean, up top where they're read. Each
  // sentence only when it says something: no "X is X", no "hasn't posted"
  // while ESPN itself is failing (that's the banner's job).
  const checked = relativeTime(data.lastUpdated);
  // No "checked N min ago" while the ESPN error banner says the check failed.
  const when = checked && !data.marketError ? `, checked ${esc(checked)}` : "";
  const upcoming = [...sections.best, ...sections.small, ...sections.other];
  const unposted = upcoming.filter((r) => r.game.market?.spread == null).length;
  const hasValue = sections.best.length + sections.small.length > 0;
  const key = [`Spreads are the home team's line.`];
  if (!named) key.push(`ESPN has no market lines for this week yet.`);
  else if (book.short !== book.full) key.push(`<b>${esc(book.short)}</b> is ${esc(book.full)}${when}.`);
  else key.push(`Market lines are ${esc(possessive(book.full))}${when}.`);
  if (games.length < allGames.length) key.push(`Splash has posted ${games.length} of ${allGames.length} games so far.`);
  if (named && !data.marketError && unposted > 0) key.push(`${esc(book.short)} hasn't posted ${unposted} yet.`);
  if (named && !hasValue && unposted < upcoming.length) key.push(`Nothing is a point or more better than ${esc(book.short)} yet.`);
  $("lines-key").innerHTML = key.join(" ");

  // Pick on Splash: in every week state (you can always go pick), only
  // once the data (and so the URL) has loaded.
  const splash = $("lines-splash");
  splash.hidden = !data.splashUrl;
  if (data.splashUrl) splash.href = data.splashUrl;
  $("lines-key").hidden = !hasLines;

  const fill = (name, rows, html) => {
    $(`lines-sec-${name}`).hidden = rows.length === 0;
    $(`lines-count-${name}`).textContent = rows.length;
    $(`lines-${name}`).innerHTML = rows.length ? html : "";
  };
  fill("best", sections.best, linesTable(sections.best, book));
  fill("small", sections.small, linesTable(sections.small, book));
  fill("other", sections.other, linesTable(sections.other, book));

  // Other games fold away while there's value to look at.
  $("lines-other-title").textContent = hasValue ? "Other games" : "Games";
  const open = !hasValue || linesOtherOpenFor === linesSlateId;
  $("lines-other").hidden = !open;
  const toggle = $("lines-other-toggle");
  toggle.hidden = !hasValue;
  toggle.setAttribute("aria-expanded", String(open));
  toggle.textContent = open ? "Hide other games" : `Show ${sections.other.length} other ${sections.other.length === 1 ? "game" : "games"}`;

  fill("paid", sections.paid, paidTable(sections.paid, book));
  // With no value left to pick, "Did value pay?" is the more useful section,
  // so it moves above the no-value Other games.
  const paidSec = $("lines-sec-paid");
  const otherSec = $("lines-sec-other");
  if (!hasValue && sections.paid.length) otherSec.before(paidSec);
  else otherSec.after(paidSec);
  const tally = valueTally(sections.paid);
  renderLinesStrip(sections.paid, tally);
  const graded = tally.wins + tally.losses + tally.ties;
  $("lines-count-paid").textContent = graded ? recordText(tally) : sections.paid.length;
  // Whose record, at which line, and what the extra points did, in one line.
  const record = recordText(tally);
  $("lines-paid-note").textContent = graded
    ? `Value sides went ${record} at Splash's lines` +
      (tally.decided ? `; the extra points decided ${tally.decided === graded ? (graded === 1 ? "it" : "all of them") : tally.decided}.` : ".")
    : "";
  $("lines-paid-note").hidden = !graded;

  // What each tier means, right under its heading where it's read, not in
  // a footnote 2,000px down.
  const keys = "3, 7 or 10, the most common winning margins";
  $("lines-desc-best").textContent =
    `2+ points better than ${book.short}, a team ${book.short} favors getting points at Splash, or a point or more across ${keys}.`;
  $("lines-desc-small").textContent = `1 to 1.5 points better, or half a point across 3, 7 or 10.`;
  $("lines-note").innerHTML = `Small grey "open" numbers are where ${esc(book.short)} opened, often weeks earlier.`;
}

$("lines-prev").addEventListener("click", () => {
  const list = linesSlates();
  const i = list.findIndex((s) => s.id === linesSlateId);
  if (i > 0) linesSlateId = list[i - 1].id;
  renderLines();
});

$("lines-next").addEventListener("click", () => {
  const list = linesSlates();
  const i = list.findIndex((s) => s.id === linesSlateId);
  if (i >= 0 && i < list.length - 1) linesSlateId = list[i + 1].id;
  renderLines();
});

$("lines-other-toggle").addEventListener("click", () => {
  linesOtherOpenFor = linesOtherOpenFor === linesSlateId ? null : linesSlateId;
  renderLines();
});

// ---- Polling and tabs ----

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json();
}

async function pollTab(tab) {
  try {
    if (tab === "overall") {
      const data = await fetchJson("/api/standings");
      renderStandings(data);
      noteUpdated(data.lastUpdated);
    } else if (tab === "weekly" || tab === "trends") {
      weeklyData = await fetchJson("/api/weekly");
      noteUpdated(weeklyData.lastUpdated);
      if (tab === "weekly") renderWeekly();
      else renderTrends();
    } else if (tab === "lines") {
      linesData = await fetchJson("/api/spreads");
      noteUpdated(linesData.lastUpdated);
      renderLines();
    } else if (tab === "aggregates") {
      aggregatesData = await fetchJson("/api/aggregates");
      noteUpdated(aggregatesData.lastUpdated);
      populateAggregatesSelect(aggregatesData);
      renderAggregatesUser(aggregatesData.byHandle ?? {}, $("aggregates-select").value);
    }
    lastFetchFailed = false;
  } catch (err) {
    lastFetchFailed = true;
    console.error(`Failed to load ${tab}`, err);
    // First load failed: say so instead of leaving "Loading…" up forever.
    // With data already showing, the stale banner covers it.
    if (tab === "lines" && !linesData) {
      $("lines-label").textContent = "Couldn't load lines";
      $("lines-state").textContent = "Trying again in a minute";
    }
  }
  await pollStatus();
}

let activeTab = "overall";

function selectTab(tab) {
  activeTab = tab;
  for (const b of document.querySelectorAll(".tab-button")) {
    const on = b.dataset.tab === tab;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;
  }
  for (const panel of document.querySelectorAll(".tab-panel")) {
    panel.hidden = panel.id !== `tab-${tab}`;
  }
  // A #tab in the URL is a one-time link; after that the saved tab (and the
  // live-week rule below) decide, so drop it rather than let it stick.
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  writeStored(TAB_STORAGE_KEY, tab);
  pollTab(tab);
}

const tabButtons = [...document.querySelectorAll(".tab-button")];
for (const button of tabButtons) {
  button.addEventListener("click", () => selectTab(button.dataset.tab));
  button.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = tabButtons.indexOf(button) + (e.key === "ArrowRight" ? 1 : -1);
    const next = tabButtons[(i + tabButtons.length) % tabButtons.length];
    next.focus();
    selectTab(next.dataset.tab);
  });
}

// ---- Light/dark toggle ----
// With no saved choice the page follows the device (prefers-color-scheme);
// a tap pins the opposite of whatever is showing, saved per device.
const THEME_STORAGE_KEY = "petz_theme";
const darkQuery = matchMedia("(prefers-color-scheme: dark)");
const themeToggle = $("theme-toggle");
const SUN_ICON =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON_ICON =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/></svg>';

function currentTheme() {
  return document.documentElement.dataset.theme ?? (darkQuery.matches ? "dark" : "light");
}

function renderThemeToggle() {
  const next = currentTheme() === "dark" ? "light" : "dark";
  themeToggle.innerHTML = next === "dark" ? MOON_ICON : SUN_ICON;
  themeToggle.setAttribute("aria-label", `Switch to ${next} mode`);
  themeToggle.title = `Switch to ${next} mode`;
}

themeToggle.addEventListener("click", () => {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  writeStored(THEME_STORAGE_KEY, next);
  renderThemeToggle();
});
darkQuery.addEventListener("change", renderThemeToggle);
renderThemeToggle();

// Opening tab: a #tab link wins; otherwise Weekly while a week is being
// played (Saturday on a phone is the main case); otherwise wherever this
// device was last, defaulting to Overall.
async function chooseInitialTab() {
  const isTab = (t) => tabButtons.some((b) => b.dataset.tab === t);
  const hash = location.hash.slice(1);
  if (isTab(hash)) return hash;
  try {
    weeklyData = await fetchJson("/api/weekly");
    const slate = slates().find((s) => s.id === defaultSlateId(slates()));
    const gamesById = new Map((slate?.games ?? []).map((g) => [g.gameId, g]));
    if (slate && weekInProgress(slate.users, gamesById)) return "weekly";
  } catch {
    // Fall through to the saved tab; the poll will surface the failure.
  }
  const saved = readStored(TAB_STORAGE_KEY);
  return isTab(saved) ? saved : "overall";
}

selectTab(await chooseInitialTab());
setInterval(() => pollTab(activeTab), POLL_INTERVAL_MS);
// Keep "Updated N min ago" honest between polls.
setInterval(renderUpdated, 30_000);
