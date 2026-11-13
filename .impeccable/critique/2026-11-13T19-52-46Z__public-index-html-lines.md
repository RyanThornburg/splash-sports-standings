---
target: "Lines tab (public/index.html#lines)"
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:/home/ratt/code/splash-sports-standings/public/index.html#lines"
timestamp: 2026-11-13T19-52-46Z
slug: public-index-html-lines
closed: true
---
Method: dual-agent (A: design review · B: detector + browser), no prior critique passed to either.

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | "checked N min ago" shown during ESPN error; live rows lack clock |
| 2 | Match System / Real World | 2 | "next Fri" on a Friday; "59 to go" of what; DK cell has no team |
| 3 | User Control and Freedom | 3 | Arrows, fold, strip jump all work |
| 4 | Consistency and Standards | 3 | Strip chevron implies expand; live rows drop Weekly's clock |
| 5 | Error Prevention | 3 | Remaining sign flip between DK column and pill |
| 6 | Recognition Rather Than Recall | 3 | DK cell teamless; desktop open-number note at bottom |
| 7 | Flexibility and Efficiency | 2 | No Splash link, no shortlist, no tonight view |
| 8 | Aesthetic and Minimalist Design | 3 | Splash cell duplicates pill on home-value rows; no-value week dash wall |
| 9 | Error Recovery | 3 | Clear ESPN and first-load failure copy |
| 10 | Help and Documentation | 3 | Good key + defs; "DK favorite"/"Crosses 10" jargon |
| **Total** | | **28/40** | **Good** |

## Design Specificity
Content authored (bet-slip pill, key-number tags, would've-pushed, kickoff order, day dividers); form is a generic odds table; no Splash handoff. Detector: markup clean (2 dark-token advisories, FP); URL desktop clean; URL 390: 2 cramped-padding on #lines-best/#lines-small (FP, cells padded ~10px). Measured: no overflow 320–1280 except paid table +5px at 320 (real); contrast min 4.70; columns aligned ≥360.

## Priority Issues
- [P1] No handoff to Splash, no shortlist: add "Pick on Splash ↗"; optional tap-to-keep shortlist strip. shape
- [P2] Edge size faintest text in row (12px ink-3): numeral voice, ink-2, 14–15px. typeset
- [P2] Copy: "next Fri" on Friday; "59 to go"; "DK FAVORITE" reads as a tip; "checked N min ago" during ESPN error. clarify
- [P2] Tonight's locks scattered; Smaller edges 18 unchunked: "3 games lock tonight" summary; fold Smaller after ~8. layout
- [P3] Strip chevron affordance; live clock missing; paid table 5px overflow at 320; move paid above Other when nothing left to pick. polish

## Persona Red Flags
Casey: 2,100px of similar rows; faint ranking number; rows not tappable; tonight's games across 3 tables. Jordan: "59 to go"; "next Fri"; "DK FAVORITE"; "Value picks 6-2" = mine?; teamless DK cell. Shopper: no Splash link/shortlist; no locks-tonight summary; movement hidden on phones; single book.

## Minor Observations
sr "DraftKings's"; repeated Other count; partial week silent on missing Best; empty week no pointer back; no-value week dash wall; paid section never says it's a strategy record.

## Questions to Consider
Shortlist you build vs report you read? Bet-slip rows on phones? Lead with "Did value pay?" on Sunday?
