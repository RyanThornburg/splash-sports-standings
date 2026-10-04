---
target: critique (public/ frontend)
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/home/ratt/code/splash-sports-standings/public/index.html"
target_fingerprint: "sha256:982caa94ac2da84e2e2a248de51290993b9f74e3784a156019893ed7e1857f3c"
target_path: /home/ratt/code/splash-sports-standings/public/index.html
timestamp: 2026-10-04T19-29-52Z
slug: public-index-html
---
Method: dual-agent (A: design review · B: detector + browser evidence)

## Design Health Score — 21/40 (Acceptable)
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | Stale banner + "Updated" only refresh on Overall (app.js:477-482); absolute timestamp; no loading state |
| 2 | Match System / Real World | 3 | "#" vs "Rank", unexplained Tiebreak, spread side ambiguous in headers |
| 3 | User Control and Freedom | 2 | 60s poll wipes weekly table (app.js:113), resets horizontal scroll; no URL state |
| 4 | Consistency and Standards | 3 | Pending "-" vs "0"; pick colors hardcoded hex not tokens |
| 5 | Error Prevention | 3 | Defaults to empty future week |
| 6 | Recognition Rather Than Recall | 2 | No legend; team abbreviations unexplained |
| 7 | Flexibility and Efficiency | 1 | No me-highlight, sort, deep links, remembered tab |
| 8 | Aesthetic and Minimalist Design | 3 | Clean; Team Picks ~60 rows, Trends ~24 bars |
| 9 | Error Recovery | 1 | Fetch errors console-only (app.js:506-508); all-caps banner, not live region |
| 10 | Help and Documentation | 1 | Nothing explains colors/italics/Tiebreak/Pending/"67 · 60%" |

## Design Specificity
Generic frame (title "Standings", system font, gray tables), highly specific data layer (live-first sort, cover-status coloring, proportional split bars). Detector: 6x undersized-ui-text (style.css:263, 10.4px mobile Overall headers, deliberate fit tradeoff), 1x side-tab (style.css:123 leader border, 2.07:1). Measured: pick-none "-" ~1.3:1, neutral trend segment 1.32:1, trend icons ~4.0:1 light. No console errors; no page h-scroll at 375px.

## Priority Issues
- [P1] Weekly matrix fights the phone mid-game: innerHTML reset each poll (app.js:113) resets scrollLeft; ~2 columns visible at 375px; 6-line headers; desktop main max-width 720px (style.css:40). Fix: preserve scroll/update in place, nowrap 2-line headers, full-width desktop, mobile "Live now"/card view. -> adapt, layout
- [P1] Freshness and errors invisible off Overall (app.js:477-482, 506-508). Fix: poll status on all tabs, relative time, inline failure notice, role=status. -> harden
- [P1] Default week is empty future slate (app.js:241). Fix: default to latest slate with picks; contextual empty copy. -> clarify
- [P2] Color-only pick outcomes, non-semantic tabs, 1.3:1 placeholder, 34px tabs. Fix: glyph + sr text, tab ARIA + arrow keys, legend, 44px tabs. -> audit, harden
- [P2] "Interesting" filters don't filter: any split qualifies (lib.js:133-135) -> ~24 rows; Team Picks 60-row flat; no movement/weekly winner. Fix: rank by drama top 5 + show all; best/worst teams; movement arrows. -> distill, bolder

## Persona Red Flags
Alex: no deep links, no me-highlight, no sorting, #/Rank ambiguity. Sam: tabs lack aria-selected, color-only outcomes, empty corner th, leader row bg-only, banner not live, 10.4px headers. Casey: scroll reset, ~2 columns, 34px top tabs, empty Week 6 default, truncated trend handles, name cells bottom-aligned.

## Minor Observations
No tabular-nums in tables; raw hex outside tokens; heavy dark leader row; toLocaleString with seconds; ambiguous "67 · 60%"; always-0 Pending on settled weeks; season trends under a week picker; duplicate independent Week selects.

## Questions to Consider
- Why does "how am I doing right now" require a 45-column scroll?
- Should Weekly on a phone be a game feed instead of a matrix?
- What would make this feel like your group's pool?
