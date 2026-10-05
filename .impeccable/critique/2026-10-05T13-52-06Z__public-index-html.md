---
target: "critique (whole site: public/index.html)"
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/home/ratt/code/splash-sports-standings/public/index.html"
target_fingerprint: "sha256:b51aca66776a477c9bb6980146b9d7d005b6744a203627736ae3c5abe3753e81"
target_path: /home/ratt/code/splash-sports-standings/public/index.html
timestamp: 2026-10-05T13-52-06Z
slug: public-index-html
---
Method: dual-agent (A: design review · B: detector + browser overlay)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Freshness + stale banner strong; week label "WEEK 5" carries no final/live/date state |
| 2 | Match System / Real World | 3 | Right vocabulary; TB/Pool explained only by hover tooltips (unreachable on phone) |
| 3 | User Control and Freedom | 3 | Change / Just looking / chevrons / switch all work; "Change" is a ~17px target |
| 4 | Consistency and Standards | 2 | Weekly chevrons vs Trends select for the same week, separate state; Team Picks select reads legacy key before petz_me |
| 5 | Error Prevention | 3 | Almost no inputs, nothing destructive |
| 6 | Recognition Rather Than Recall | 3 | Icon keys repeat; TB/Pool rely on recall |
| 7 | Flexibility and Efficiency | 2 | Opens on Overall even mid-game; no week deep link; Team Picks unsortable |
| 8 | Aesthetic and Minimalist Design | 2 | ~3,750px finals scroll, redundant "Your pick" tag on every My-picks row, 24-row Trends, ~70-row Team Picks |
| 9 | Error Recovery | 3 | Plain, reassuring stale copy |
| 10 | Help and Documentation | 2 | Icon keys present; nothing explains TB, Pool, or what makes a Trends game "interesting" |
| **Total** | | **26/40** | **Acceptable** |

## Design Specificity Verdict
Weekly is authored (your-week tiles, solid-you/outlined-friend chips hung under the picked team, trophy-for-leader, freshness on every tab). But the score bug only renders on game days; off-Saturday Weekly is a white finals list and Overall/Team Picks/Trends are token-skinned generic tables and bars (documented as deferred). Detector: 20 advisory findings, 0 above advisory. 3 design-system-color = dark-theme token values missing from DESIGN.md frontmatter (doc gap, not drift). 14 font-size (13/14/17px) and 2 of 3 radius (5px meter pill ends) are documented-in-prose sizes off the frontmatter ramp (false positives). 1 radius 4px at style.css:1186 unchecked. Browser overlay: clean on Overall, Weekly (390+1280), Team Picks; Trends 390px: text-overflow on .meter-game (ellipsis-truncated "STAN @ WAKE (-12.5)"), corroborating the review's truncation note.

## Priority Issues
- [P1] Trends "Our group" flags nearly every game: computeGroupTrends (lib.js:134) treats any two-sided game as a split, incl. 1-v-1; Week 5 shows 24 equal rows. Fix: rank (you in minority > 4+ consensus > even splits), cap ~5 with "Show all N". distill.
- [P1] Weekly finals list ~3,750px on a phone: "Your pick" mytag (app.js:210) repeats on every row in My picks mode; chips stack one per line. Fix: drop mytag in mine mode, wrap chips inline, collapse Final to a summary line when games are live/later. distill → layout.
- [P1] Opens on Overall even when games are live (app.js:761). Fix: default to Weekly when the current slate is in progress, else remember last tab. adapt.
- [P2] Trends handles rows misattribute: wrapped handle list under a narrow team segment reads as the other team's (e.g. WVU/ISU row). Fix: per-segment gap/divider or list under-dog handles separately. layout.
- [P2] Week label carries no state: add "Final · Sep 27–29" / "3 live · 9 left" subline. clarify.

## Persona Red Flags
Casey: tap Overall→Weekly first; 17px "Change" beside handle; 24px finals chips; TB/Pool tooltips unreachable. Alex: no URL for a week; Trends/Weekly week state not shared; Team Picks unsortable. Ken-grapes (leader, Sunday): only a 12px trophy marks the week win; no recap line.

## Minor Observations
Pool meter labels truncate team names on phone; Trends bars become thin long lines at 1280; TB has no visible "lower is better"; your-week key wraps one word; dark-mode Trends bars louder than rest of dark theme; Team Picks select prefers legacy splash_selected_user over petz_me (app.js:446); DESIGN.md frontmatter lacks dark values.

## Questions to Consider
- Should finals use the score-bug material so the product looks like itself on a Tuesday?
- Should "your head-to-heads this week" live as a 3-row strip in Weekly instead of a separate Trends wall?
- Should a settled week end with one bragging line (winner, record, best contrarian hit)?
