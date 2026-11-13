---
target: "Lines tab (public/index.html#lines)"
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/home/ratt/code/splash-sports-standings/public/index.html#lines"
timestamp: 2026-11-13T19-04-41Z
slug: public-index-html-lines
closed: true
---
Method: dual-agent (A: design review · B: detector + browser), no prior critique passed to either.

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Good state/freshness lines; paid rows lack amber live state; "Kicked off"+"No score yet" duplicate |
| 2 | Match System / Real World | 3 | Mixed perspective: home-line columns vs value-side pill |
| 3 | User Control and Freedom | 3 | Hide toggle ~3,700px down; rows not tappable |
| 4 | Consistency and Standards | 2 | Provider string flips (DK vs DRAFT KINGS); phone tables misalign; live rows not amber |
| 5 | Error Prevention | 2 | Sign flip between columns invites wrong side |
| 6 | Recognition Rather Than Recall | 2 | Tier/tag definitions only in footnote; "better" than what |
| 7 | Flexibility and Efficiency | 2 | Points-only sort vs Splash's kickoff-ordered sheet; no Splash link |
| 8 | Aesthetic and Minimalist Design | 3 | Key line balloons in partial weeks; Smaller edges is a wall |
| 9 | Error Recovery | 3 | Empty week shows "MARKET is Market … 0 of 66" |
| 10 | Help and Documentation | 3 | Accurate footnote, last on page; British "favourite" |
| **Total** | | **26/40** | **Acceptable** |

## Design Specificity
Language authored (Value cell, tags, "Did value pay?"); form still a generic odds table; ignores the friend group. Detector: markup clean (2 dark-token advisories, false positive); URL: line-length on #lines-note (~112ch, real/minor), cramped-padding on #lines-best/#lines-small at 390 (real asymmetry: 10px left vs 4px right because hidden .col-ou leaves Value as last visible cell). No overflow anywhere; .res contrast 5.35–8.17; section count 4.23:1 light.

## Priority Issues
- [P1] ESPN provider string flips "Draft Kings"/"DraftKings" between refreshes (confirmed 18:53Z vs 18:58Z) → "DRAFT KINGS is Draft Kings", 375px crowding; "MARKET is Market" when empty. Normalize in Worker. harden
- [P1] Mixed perspective "MD +7.5 | +9.5 | WIS −7.5": label DK cell with team and/or "vs DK −9.5" under the pill. clarify
- [P1] "Did value pay?" buried; summary strip under week nav, group Live/Final/Waiting, amber live, one waiting signal, drop "· ". layout
- [P2] Smaller edges wall sorted by points; sort by kickoff within tier or flag tonight's locks. layout
- [P2] Degenerate states: no-value week, empty week, ESPN error + unposted count; asymmetric phone padding. harden

## Persona Red Flags
Casey: definitions ~2,000px down; hide toggle ~3,700px; no Splash link; results below fold. Jordan: home-line vs away pill; "better" than what; jargon tags; "DRAFT KINGS is Draft Kings"; "Missed"; "· 13-5". Shopper: fast shortlist; no own/friends' picks; Friday locks not flagged; no hand-off.

## Minor Observations
Phone tables misalign ~5px; present-tense "better" on finals; duplicate freshness; 11px tags carry the why; dark Best/Small pill outlines nearly identical; count contrast 4.23.

## Questions to Consider
Should Lines know who's asking? Ordered for reading or copying into Splash? Season-long value record as the headline?
