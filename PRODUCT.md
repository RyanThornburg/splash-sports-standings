# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A closed group of six friends, matched by their case-sensitive Splash handles in `src/config.ts` `FILTERED_HANDLES`: Rattly, THE_LEDGE, lucky_dog, EMILYK24, NMEPitt, Ken-grapes. Nobody else is an intended user, so there's no broader or anonymous audience to design for.

What they mostly come to do:
- **Live sweat on Saturdays.** Mid-game, usually on a phone, they check whether their picks are covering the spread right now and how their friends' picks are doing.
- **Where I stand overall.** They check their season ranking within the group.

The user also asked for these to be explored and mocked up, but they aren't confirmed as core jobs:
- comparing picks with friends (consensus vs contrarian)
- a post-week recap or bragging layer (weekly winner, bad beats)

## Product Purpose

The site shows a Splash Sports college-football team pick-em contest filtered to just this friend group. Splash has no way to filter a contest to a subset of users. The old officefootballpool.com, which Splash acquired, did, and this site replaces that feature.

**Success:** any of the six can open the site and see the group's results right away, live or settled, without wading through the whole contest.

## Positioning

The six run a side bet among themselves inside a larger public Splash pool, **Petz Pool**. Splash's own standings mix them in with roughly 120 other entrants. This site is the only view that shows the side bet as its own competition. Ranking and comparing within the group is the point; pool-wide rank is secondary context.

## Operating Context

**Weekly rhythm:**
- Each week ("slate"), every entrant picks a required number of games against the spread (e.g. 20 of ~43).
- Most games are on Saturday, with some on weekday nights, including Monday.
- The data is scraped from Splash by a cron job every few minutes, so live views are near-real-time rather than instant.
- The site polls every 60s.

**What's at stake:**
- The broader Petz Pool pays out weekly winners and the season's top ten through Splash.
- The friends' side bet is separate and settled among themselves. The site doesn't track any money.

**Where it's used:** mostly phones, often one-handed while watching games. Desktop is secondary.

## Capabilities and Constraints

**Data:** season standings (record, win %, pending picks, guess-the-score tiebreaker, pool-wide rank) and per-week picks for each friend, which include:
- the team picked and its spread
- Splash's grade: won, lost, push, or the live readings winning and losing
- live game state (score, quarter, clock)
- pool-wide pick popularity for context

**Stack:** a single Cloudflare Worker serves `/api/*` from a KV cache plus a plain static frontend (`public/`). There is no framework and no build step. The frontend is an ES module, and pure logic lives in `public/lib.js` so it can be tested.

**Data limits:**
- The frontend only ever talks to this Worker, never to Splash directly.
- The ~120 entrants outside the group have no per-pick grades. Their outcomes can only be derived from score plus spread.

**Terminology:** slate/week, spread, cover, push, pending, tiebreaker (guess-the-score difference, where lower is better), handle.

**Undecided:** the side bet's stakes and payout structure. Don't invent amounts or rules.

## Brand Commitments

- The pool is named **Petz Pool** (Splash's name for the contest), and the site may use that name.
- The friends' handles are shown exactly as Splash spells them.
- There's a link back to the real contest on Splash (`SPLASH_STANDINGS_URL`).

## Evidence on Hand

- Live season data from the deployed Worker's `/api/standings`, `/api/weekly`, `/api/aggregates` and `/api/status`.
- No photography, logos or other brand assets exist. Don't fabricate a logo or claim affiliation with Splash Sports.

## Product Principles

1. **The group is the universe.** Rank, compare and celebrate within the six. Pool-wide numbers are background.
2. **Saturday on a phone is the main case.** Live state, freshness and one-handed scanning come before desktop density.
3. **Trust Splash's own numbers.** Show Splash's grades and aggregates. Don't re-derive outcomes where Splash already gives them.
4. **Always say how fresh the data is.** Live coloring is only meaningful if users can tell when it was last updated.

## Accessibility & Inclusion

Friends-only tool with a known, small audience. Full WCAG conformance isn't a goal. Keep the cheap wins that help everyone: legible contrast, and status that never relies on colour alone.
