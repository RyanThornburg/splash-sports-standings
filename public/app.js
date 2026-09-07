import {
  computeWeeklyPending,
  gameHeaderLines,
  pickCellClass,
  recordText,
  sortGameIds,
  winPct,
  withGroupRank,
} from "./lib.js";

const POLL_INTERVAL_MS = 60_000;
const SELECTED_USER_STORAGE_KEY = "splash_selected_user";

const updated = document.getElementById("updated");
const staleBanner = document.getElementById("stale-banner");

function setUpdated(lastUpdated) {
  updated.textContent = lastUpdated
    ? `Updated ${new Date(lastUpdated).toLocaleString()}`
    : "Not yet updated";
}

function getStoredUser() {
  try {
    return localStorage.getItem(SELECTED_USER_STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStoredUser(handle) {
  try {
    localStorage.setItem(SELECTED_USER_STORAGE_KEY, handle);
  } catch {
    // Storage unavailable (private browsing, blocked) — selection just won't persist.
  }
}

async function pollStatus(lastUpdated) {
  try {
    const res = await fetch("/api/status");
    const status = await res.json();
    if (status.ok === false) {
      staleBanner.textContent = `DATA NOT LIVE, LAST REFRESH ${
        lastUpdated ? new Date(lastUpdated).toLocaleString() : "unknown"
      }`;
      staleBanner.hidden = false;
    } else {
      staleBanner.hidden = true;
    }
  } catch (err) {
    console.error("Failed to load status", err);
  }
}

function renderStandings(data) {
  const table = document.getElementById("standings");
  const empty = document.getElementById("standings-empty");
  const tbody = document.getElementById("standings-body");
  const entries = data.entries ?? [];

  table.hidden = entries.length === 0;
  empty.hidden = entries.length > 0;
  tbody.innerHTML = "";

  const splashLink = document.getElementById("splash-link");
  if (data.splashUrl) {
    splashLink.href = data.splashUrl;
    splashLink.hidden = false;
  } else {
    splashLink.hidden = true;
  }

  // The tiebreaker (guess-the-score) has no values until that game is
  // played, so the whole column is just noise until then — hide it rather
  // than show "-" for everyone all season.
  const hasTiebreak = entries.some((entry) => entry.tiebreakerDiff !== null);
  document.getElementById("tiebreak-header").hidden = !hasTiebreak;

  for (const { entry, groupRankLabel, groupRank } of withGroupRank(entries)) {
    const row = document.createElement("tr");
    if (groupRank === 1) row.classList.add("rank-leader");

    const cells = [
      [groupRankLabel],
      [entry.displayRank],
      [entry.displayName ?? entry.handle],
      [recordText(entry)],
      [winPct(entry), "col-num"],
      [entry.pending ?? "-", "col-num" + (entry.pending > 0 ? " pending-active" : "")],
    ];
    if (hasTiebreak) {
      cells.push([entry.tiebreakerDiff ?? "-", "col-num"]);
    }

    for (const [text, className] of cells) {
      const cell = document.createElement("td");
      cell.textContent = text;
      if (className) cell.className = className;
      row.appendChild(cell);
    }
    tbody.appendChild(row);
  }
}

let weeklyData = null;

function renderWeeklyWeek(slate) {
  const container = document.getElementById("weekly-content");
  const empty = document.getElementById("weekly-empty");
  container.innerHTML = "";

  if (!slate) {
    empty.hidden = false;
    return;
  }

  const handles = Object.keys(slate.users ?? {});
  empty.hidden = handles.length > 0;
  if (handles.length === 0) return;

  const gamesById = new Map((slate.games ?? []).map((g) => [g.gameId, g]));

  // Only the games at least one shown user actually picked, chronological.
  const pickedGameIds = new Set();
  for (const handle of handles) {
    for (const pick of slate.users[handle].picks) {
      pickedGameIds.add(pick.gameId);
    }
  }
  const gameIds = sortGameIds(pickedGameIds, gamesById);

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  const cornerHeader = document.createElement("th");
  cornerHeader.className = "row-label sticky-col";
  headerRow.appendChild(cornerHeader);

  const scoreHeader = document.createElement("th");
  scoreHeader.className = "col-num";
  scoreHeader.textContent = "Score";
  headerRow.appendChild(scoreHeader);

  const pendingHeader = document.createElement("th");
  pendingHeader.className = "col-center";
  pendingHeader.textContent = "Pending";
  headerRow.appendChild(pendingHeader);

  for (const gameId of gameIds) {
    const game = gamesById.get(gameId);
    const th = document.createElement("th");
    if (game) {
      const { matchup, detail, live, clock } = gameHeaderLines(game);
      if (live) th.classList.add("game-header-live");
      const matchupLine = document.createElement("div");
      matchupLine.textContent = matchup;
      th.appendChild(matchupLine);
      if (detail) {
        const detailLine = document.createElement("div");
        detailLine.textContent = detail;
        detailLine.className = live ? "game-live" : "game-detail";
        th.appendChild(detailLine);
      }
      if (clock) {
        const clockLine = document.createElement("div");
        clockLine.textContent = clock;
        clockLine.className = "game-detail";
        th.appendChild(clockLine);
      }
    } else {
      th.textContent = "?";
    }
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);

  const tbody = document.createElement("tbody");
  for (const handle of handles) {
    const week = slate.users[handle];
    const row = document.createElement("tr");

    const nameCell = document.createElement("th");
    nameCell.textContent = handle;
    nameCell.scope = "row";
    nameCell.className = "row-label sticky-col";
    row.appendChild(nameCell);

    const scoreCell = document.createElement("td");
    scoreCell.textContent = week.wins;
    scoreCell.className = "col-num";
    row.appendChild(scoreCell);

    // Explains why a week's row might show fewer picks than
    // slate.picksRequiredCount — some are still un-submitted or un-graded.
    const pending = computeWeeklyPending(week, slate.picksRequiredCount);
    const pendingCell = document.createElement("td");
    pendingCell.textContent = pending;
    pendingCell.className = "col-center" + (pending > 0 ? " pending-active" : "");
    row.appendChild(pendingCell);

    const picksByGame = new Map(week.picks.map((p) => [p.gameId, p]));
    for (const gameId of gameIds) {
      const cell = document.createElement("td");
      const pick = picksByGame.get(gameId);
      if (pick) {
        cell.textContent = pick.team.alias;
        cell.className = pickCellClass(pick, gamesById.get(gameId));
      } else {
        cell.textContent = "—";
        cell.className = "pick-none";
      }
      row.appendChild(cell);
    }
    tbody.appendChild(row);
  }

  table.appendChild(thead);
  table.appendChild(tbody);
  container.appendChild(table);
}

function populateWeeklySelect(data) {
  const select = document.getElementById("weekly-select");
  const slates = data.slates ?? [];
  const previousValue = select.value;

  select.innerHTML = "";
  for (const slate of slates) {
    const option = document.createElement("option");
    option.value = slate.id;
    option.textContent = slate.name + (slate.isCurrentSlate ? " (current)" : "");
    select.appendChild(option);
  }

  if (slates.length === 0) return;
  const stillExists = slates.some((s) => s.id === previousValue);
  select.value = stillExists ? previousValue : slates[slates.length - 1].id;
}

function renderAggregatesUser(byHandle, handle) {
  const container = document.getElementById("aggregates-content");
  const empty = document.getElementById("aggregates-empty");
  container.innerHTML = "";

  const stats = byHandle[handle];
  empty.hidden = Boolean(stats && stats.length > 0);
  if (!stats || stats.length === 0) return;

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>Team</th><th>Picks</th><th>Record</th></tr>";
  const tbody = document.createElement("tbody");

  for (const stat of stats) {
    const row = document.createElement("tr");
    for (const text of [stat.teamName, stat.picks, `${stat.wins}-${stat.losses}`]) {
      const cell = document.createElement("td");
      cell.textContent = text;
      row.appendChild(cell);
    }
    tbody.appendChild(row);
  }

  table.appendChild(thead);
  table.appendChild(tbody);
  container.appendChild(table);
}

function populateAggregatesSelect(data) {
  const select = document.getElementById("aggregates-select");
  const handles = Object.keys(data.byHandle ?? {}).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
  const previousValue = select.value || getStoredUser();

  select.innerHTML = "";
  for (const handle of handles) {
    const option = document.createElement("option");
    option.value = handle;
    option.textContent = handle;
    select.appendChild(option);
  }

  if (handles.length === 0) return;
  select.value = handles.includes(previousValue) ? previousValue : handles[0];
}

let aggregatesData = null;

async function pollTab(tab) {
  try {
    if (tab === "overall") {
      const res = await fetch("/api/standings");
      const data = await res.json();
      renderStandings(data);
      setUpdated(data.lastUpdated);
      await pollStatus(data.lastUpdated);
    } else if (tab === "weekly") {
      const res = await fetch("/api/weekly");
      weeklyData = await res.json();
      populateWeeklySelect(weeklyData);
      const select = document.getElementById("weekly-select");
      const slate = (weeklyData.slates ?? []).find((s) => s.id === select.value);
      renderWeeklyWeek(slate);
    } else if (tab === "aggregates") {
      const res = await fetch("/api/aggregates");
      aggregatesData = await res.json();
      populateAggregatesSelect(aggregatesData);
      const select = document.getElementById("aggregates-select");
      renderAggregatesUser(aggregatesData.byHandle ?? {}, select.value);
    }
  } catch (err) {
    console.error(`Failed to load ${tab}`, err);
  }
}

document.getElementById("weekly-select").addEventListener("change", (e) => {
  const slate = (weeklyData?.slates ?? []).find((s) => s.id === e.target.value);
  renderWeeklyWeek(slate);
});

document.getElementById("aggregates-select").addEventListener("change", (e) => {
  setStoredUser(e.target.value);
  renderAggregatesUser(aggregatesData?.byHandle ?? {}, e.target.value);
});

let activeTab = "overall";

for (const button of document.querySelectorAll(".tab-button")) {
  button.addEventListener("click", () => {
    activeTab = button.dataset.tab;

    for (const b of document.querySelectorAll(".tab-button")) {
      b.classList.toggle("active", b === button);
    }
    for (const panel of document.querySelectorAll(".tab-panel")) {
      panel.hidden = panel.id !== `tab-${activeTab}`;
    }

    pollTab(activeTab);
  });
}

pollTab("overall");
setInterval(() => pollTab(activeTab), POLL_INTERVAL_MS);
