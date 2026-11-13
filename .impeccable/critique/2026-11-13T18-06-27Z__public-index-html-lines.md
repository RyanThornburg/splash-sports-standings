---
target: "Lines tab (public/index.html#lines)"
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/home/ratt/code/splash-sports-standings/public/index.html#lines"
timestamp: 2026-11-13T18-06-27Z
slug: public-index-html-lines
---
Method: dual-agent (A: design review · B: detector + browser). Both assessed the favourite-side version; the home-team-line switch (deployed during the run) is reflected here.

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | DK freshness only in bottom footnote; header "Updated" is the Splash cron |
| 2 | Match System / Real World | 2 | Value pill "ND +1" reads as a spread; away-side value needs the away line worked out |
| 3 | User Control and Freedom | 3 | Can't collapse Everything else or hide no-line rows |
| 4 | Consistency and Standards | 2 | Select vs Weekly's chevrons; "None" vs "–"; "open" label desktop-only |
| 5 | Error Prevention | 2 | Flipped favourite looks like any +3; months-old ESPN opens shown at full confidence |
| 6 | Recognition Rather Than Recall | 2 | Non-sticky headers over 18/41 rows; bare grey open numbers on phones |
| 7 | Flexibility and Efficiency | 2 | One sort, no link to Splash, no "my picks" |
| 8 | Aesthetic and Minimalist Design | 3 | Calm; up to 8 numbers per row, O/U not ATS-relevant |
| 9 | Error Recovery | 3 | ESPN error copy good; "None" ambiguous |
| 10 | Help and Documentation | 2 | Only help is a fragmentary last-line footnote |
| **Total** | | **24/40** | **Acceptable** |

## Design Specificity
Rule-compliant (neutral pill, tabular condensed numerals, amber only for ESPN error) but a generic odds grid; nothing about this pool's week (locks, picks). Detector: markup clean; live-page scan 20 cramped-padding (18 .edge.strong pills, 2 board-scroll panels) — panels false positive (existing waiver is path-keyed), pills mostly false positive with a real tight 3px inset at 375px; 2 design-system-color advisories are DESIGN.md dark tokens (false positive). Overlay needed inline injection (Private Network Access blocked localhost script). No overflow at 375/390/1280; ink-3 sub-lines 4.70:1 light; targets 40px.

## Priority Issues
- [P1] Value cell doesn't state the bet (make it "ALA −15.5" with "2 better than DK" beneath). clarify
- [P1] Open numbers unlabelled on phones and of doubtful value: ESPN "open" is a weeks-early lookahead (TTU@OKST +15.5→−3.5 verified as ESPN's raw data, not a mapping bug). Drop them, or desktop-only labelled; drop O/U on phones. distill
- [P2] Line value not selective: 18 of 59, 13 at +1; key-number half-points (3/7) and flipped favourites not surfaced. Tier it. layout
- [P2] Kicked off is all "None / – / –"; turn into "did the value side cover". shape
- [P3] Shell: chevron week nav with state line (lock time, DK freshness); "–" everywhere. polish

## Persona Red Flags
Casey: 3 cells + arithmetic per bet; headers scroll away; key 60 rows down; rows not tappable. Jordan: "ND +1" as spread; DK unexplained; "None" ambiguous; broken footnote. Friday-night shopper: 18 identical pills; no lock time/DK freshness; phantom line moves from lookahead opens.

## Minor Observations
Tooltips useless on touch; O/U right-aligned vs left-aligned numerics; no time zone; 48px rows lengthen scroll; desktop table should cap ~700px.

## Questions to Consider
Line-movement view (Splash → DK now) instead of two columns? 3–5 value cards above a reference table? "Did line value pay?" tally?
