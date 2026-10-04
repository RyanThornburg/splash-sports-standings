---
version: 1
slug: "public-index-html"
primary_target: "public/index.html"
related_targets: ["public/app.js","public/style.css"]
---

# Weekly (and the site shell)

Scope: the Weekly tab of public/index.html, plus the shared shell (header, freshness, tabs) and token restyle that Overall, Team Picks and Trends inherit. Mode: Operate. Confirmed with the user 2026-10-04 after mockups (gallery option C, revised).

Audience/job: one of the six friends, on a phone mid-game, checking "how are my picks doing right now and how do I compare". Also: browsing settled past weeks. Pre-kickoff weeks are out of scope (Weekly defaults to the latest week that has picks).

Constraints: plain static HTML/JS, no build step; new pure logic in public/lib.js with tests in test/lib.test.ts; 60s polling must not lose the reader's place; freshness visible on every tab. "You" is chosen per visitor on first visit (stored on the device), changeable.

Open: Overall/Team Picks/Trends get the token restyle now; their own structural redesign is later work.

## Direction contract

THESIS: Weekly is a stack of TV score bugs, not a person-by-game grid. Each game is one broadcast scoreboard bar with the friends who picked each side hanging beneath it. It refuses the spreadsheet matrix and the rounded-card sports-app list.

OWN-WORLD: cool light grey page; charcoal scoreboard bars with white condensed numerals (Barlow Semi Condensed, self-hosted) and the platform system-ui sans for names (Inter dropped after the detector flagged it as overused); amber reserved for LIVE only; green/red only on pick chips and always paired with a drawn check/x/triangle icon. Pills for chips, 10px-radius bars, hairline-ruled white panels for finals and your-week. Dark theme swaps the page to near-black and keeps bars charcoal.

STORY: the visitor sees where the six stand this week, then their own week at a glance (record, live up/down, picks left, one tile per pick), then their games: live first, later today, final. One tap switches to every game the group picked.

FIRST VIEWPORT: header row (PETZ POOL, Updated N min ago), week nav ‹ Week 5 ›, charcoal standings board (rank, handle, W-L, left; your row lifted, "You · Change"), Your week strip with 20 tiles. Sticky My picks / All games switch just below.

FORM: TV score bug (safer-register grounded candidate, picked by the user over the category standard and box-score); seed key f5c26f2f.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
