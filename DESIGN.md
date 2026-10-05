---
name: Petz Pool
description: A friends-only side-bet view of a Splash Sports pick-em contest, drawn as TV score bugs.
colors:
  page: "#f2f3f5"
  card: "#ffffff"
  line: "#e1e3e8"
  ink: "#1d1f24"
  ink-2: "#555b66"
  ink-3: "#6e747f"
  bar: "#323844"
  bar-2: "#3e4552"
  bar-3: "#4a5261"
  on-bar: "#ffffff"
  on-bar-2: "#c0c6d0"
  on-solid: "#ffffff"
  sel-bg: "#323844"
  sel-ink: "#ffffff"
  live: "#f5a524"
  win-bg: "#fbf3d9"
  win-ink: "#8f6a00"
  live-ink: "#8a5300"
  live-bg: "#fdf1dc"
  good: "#1d7a45"
  good-bg: "#e5f3ea"
  bad: "#b8352b"
  bad-bg: "#fbe9e7"
  push-bg: "#eceef1"
  accent: "#3a6fd8"
typography:
  display:
    fontFamily: "Barlow Semi Condensed, Roboto Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
  headline:
    fontFamily: "Barlow Semi Condensed, Roboto Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.01em"
  title:
    fontFamily: "Barlow Semi Condensed, Roboto Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    letterSpacing: "0.06em"
  numeral:
    fontFamily: "Barlow Semi Condensed, Roboto Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
  name:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, sans-serif"
    fontSize: "15px"
    fontWeight: 500
  label:
    fontFamily: "Barlow Semi Condensed, Roboto Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.08em"
rounded:
  panel: "10px"
  inner: "7px"
  control: "8px"
  pill: "13px"
  pill-lg: "20px"
spacing:
  hair: "4px"
  sm: "8px"
  md: "12px"
  lg: "14px"
  gutter: "16px"
  section: "24px"
components:
  score-bug:
    backgroundColor: "{colors.bar}"
    textColor: "{colors.on-bar}"
    rounded: "{rounded.panel}"
    height: "58px"
  standings-board:
    backgroundColor: "{colors.bar}"
    textColor: "{colors.on-bar}"
    rounded: "{rounded.panel}"
    padding: "0 14px"
  standings-row-me:
    backgroundColor: "{colors.bar-3}"
    textColor: "{colors.on-bar}"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "0 9px 0 7px"
    height: "26px"
  chip-good:
    textColor: "{colors.good}"
  chip-bad:
    textColor: "{colors.bad}"
  chip-me:
    backgroundColor: "{colors.bar}"
    textColor: "{colors.on-bar}"
    rounded: "{rounded.pill}"
  chip-me-good:
    backgroundColor: "{colors.good}"
    textColor: "{colors.on-solid}"
  chip-me-bad:
    backgroundColor: "{colors.bad}"
    textColor: "{colors.on-solid}"
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    typography: "{typography.title}"
    rounded: "{rounded.inner}"
    height: "40px"
  tab-selected:
    backgroundColor: "{colors.sel-bg}"
    textColor: "{colors.sel-ink}"
  tile-good:
    backgroundColor: "{colors.good-bg}"
    textColor: "{colors.good}"
    rounded: "{rounded.inner}"
    height: "44px"
  tile-bad:
    backgroundColor: "{colors.bad-bg}"
    textColor: "{colors.bad}"
    rounded: "{rounded.inner}"
    height: "44px"
  tile-live:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.inner}"
  panel:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "14px"
---

# Design System: Petz Pool

## Overview

**Creative North Star: "The Saturday Score Bug"**

Petz Pool looks like the scoreboard strip in the corner of a college football broadcast, not a spreadsheet and not a rounded-card sports app. Each game is one charcoal bar with condensed white numerals, a clock cell on the right, and the friends who picked each side hanging beneath it as pills. Standings use the same charcoal bar material, so the group's ranking and the games read as one broadcast package.

The page around the bars is quiet: a cool light grey with white, hairline-bordered panels for "your week", the finals list, and the controls. Color is rationed by meaning. Amber means "happening now", green and red mean a pick's status and never appear without a drawn icon, and blue only measures popularity, and gold only crowns the leader. The bars are a cool slate (#323844) rather than near-black, lighter on the grey page while still reading as a scoreboard. The dark theme swaps the page to near-black and keeps the bars charcoal, so the bugs stay the brightest-edged objects on screen.

Density is tuned for a phone held one-handed during a game: 40-44px touch rows, a 10-across tile strip for the week's picks, and a sticky My picks / All games switch. Only the Weekly tab and the shared shell were built in this world. Overall, Team Picks and Trends got the token restyle only (charcoal tables, condensed labels, the shared palette); their structural redesign is deferred, so treat their layouts as provisional, not as the pattern to copy.

**Key Characteristics:**
- Charcoal broadcast bars with condensed tabular numerals for every score, record and count.
- Platform system-ui for people's handles and running text.
- Amber is the "now" color; green/red are pick status only, always with an icon.
- Your own pick is solid; friends' picks are outlined.
- Flat surfaces; depth comes from tone (charcoal on grey), not shadows.

## Colors

A cool neutral grey world with one charcoal material, one amber "now" signal, a green/red pick-status pair, and a blue reserved for popularity. Every token is redefined for dark, which follows the device (`prefers-color-scheme`) until the header's sun/moon toggle pins a choice: `data-theme="light"|"dark"` on `<html>`, saved per device in `localStorage` key `petz_theme` and applied by an inline head script before first paint. The hex values below are the light theme.

### Primary
- **Broadcast Slate** (bar): the scoreboard material, used only by the score bugs (and the selected tab/switch via `sel-bg`). `bar-2` is the clock cell and team divider. Standings tables are white panels, not slate.
- **Bar White / Bar Grey** (on-bar, on-bar-2): primary numerals and names on charcoal; on-bar-2 for ranks, spreads, column heads, "left" counts and the trailing team's score.

### Secondary
- **Clock Amber** (live): the live dot, the quarter label in a live bug's clock cell, and the border of a tile whose game is in progress. `live-ink` and `live-bg` are its text and tint forms, used by the stale-data banner.
- **Covering Green** (good, good-bg) and **Not-Covering Red** (bad, bad-bg): pick status on chips, tiles, the live up/down counts, and Trends' group bars. `push-bg` is the neutral tint for pushes.

### Tertiary
- **Popularity Blue** (accent): fills the Pool meters on Trends. It is a deliberately different hue from green/red so "how many picked it" is never confused with "did it win".

### Neutral
- **Cool Grey Page** (page): the canvas, and the background of the sticky switch wrapper so content scrolls under it cleanly.
- **Panel White** (card): your-week panel, finals list, tab bar, week nav, select.
- **Hairline** (line): 1px panel borders, row rules, outlined chip strokes, meter tracks.
- **Ink / Ink 2 / Ink 3** (ink, ink-2, ink-3): text in three steps: primary, secondary (section titles, unselected tabs, notes), tertiary (counts, keys, losing team in finals).
- **Selection Ink** (sel-bg, sel-ink): the selected tab and switch segment, plus text selection. Charcoal on white in light; inverts to near-white on near-black in dark, so the selected control is always the strongest surface.

### Named Rules
**The Gold Is The Winner Rule.** Gold (`win-bg` row tint, `win-ink` trophy) marks only the leader: the week's rank-1 row on Weekly's "This week" table and the season's rank-1 row on Overall (ties share it, nobody gets it at 0 wins). A trophy icon replaces the rank number, with screen-reader text "Leading this week" / "Won the week" / "Season leader". Gold beats the "you" row tint when you lead. It is distinct from live amber and never appears without the trophy.

**Quiet Tables Rule.** Standings are not scoreboards: Weekly's "This week", Overall and Team Picks all sit in a white ruled panel (`card`, `line` hairlines, 40px rows; Overall/Team Picks span the full column, matching the tab bar) with semibold 17px condensed records and regular-weight grey numbers. The slate bar is reserved for the score bugs. The leader uses `win-bg` with a `win-ink` trophy, and your row a faint `page` tint.

**The Amber Is Now Rule.** Amber marks time-sensitive state only: a game in progress (live dot, clock quarter label, live tile border) and the stale-data warning. Never decoration, never a status.

**The Never Color Alone Rule.** Green and red appear only on pick status and always beside a drawn SVG icon: check (won), x (lost), up triangle (covering), down triangle (not covering), dash (push or tied), ring (not started). A legend of the same icons accompanies the tile strip and the live section.

**The Blue Is Count Rule.** The accent blue measures popularity and nothing else. Season-long pool trends carry no status color at all.

## Typography

**Display Font:** Barlow Semi Condensed 500/600/700, self-hosted woff2 (OFL), with Roboto Condensed, Arial Narrow, system-ui fallbacks
**Body Font:** system-ui (-apple-system, Segoe UI, Roboto, Helvetica Neue)

**Character:** The condensed face is the scoreboard lettering: numerals, team abbreviations, uppercase titles and labels. The platform sans carries anything a person wrote or is called, so handles stay exactly as Splash spells them and read naturally.

### Hierarchy
- **Display** (700, 32px, 1): live scores in a bug; 20px in the finals list.
- **Headline** (700, 24px, 1.1, uppercase): the "Petz Pool" wordmark. Week label and "Which one are you?" use 700 18px uppercase.
- **Title** (700, 15px, 0.05-0.06em, uppercase): section titles, tabs, switch segments, your-week title, picker labels.
- **Numeral** (700, 18-21px, tabular): W-L records (20px), ranks (18px), team abbreviations (21px in bugs, 17px in finals), stat values.
- **Body** (400, 15px, 1.4): notes, empty states, keys (12-13px, ink-2/ink-3).
- **Name** (500-600, 13-15px, system-ui): handles in the board and on chips (13px chips, 700 on your own chip).
- **Label** (600-700, 12px, 0.08em, uppercase): board column heads, clock quarter, "Your pick" tag, stat units, "Final".

### Named Rules
**The Two Voices Rule.** Condensed for numerals, abbreviations, labels and uppercase titles; system-ui for names and body. Never set a handle in the condensed face, and never set a score in the sans.

**The Tabular Numerals Rule.** `tabular-nums` goes on numeric cells only (scores, records, ranks, counts, clock, meter values), so columns align during live updates. Text cells don't get it.

## Layout

A single centered column, max 1080px, 16px side gutters, 18px top and 48px bottom padding. Section titles sit 24px above their content with 10px below. Controls (tab bar, week nav, switch) are white trays with 4px inner padding holding 40px-high targets.

Weekly's standings table is a four-column grid (40px rank, flexible name, 64px W-L, 52px left), 32px header, 40px hairline-ruled rows on a white panel. A score bug is a three-column grid (away, home, 70px clock), 58px tall, with a matching grid of pick pills below it so each side's friends hang under their team. Finals are compact two-team rows on one white panel with a 44px "Final" column. The your-week strip is a 10-column tile grid with 4px gaps.

At **900px and up**: live and later bugs go two per row (18px row gap, 20px column gap), finals split into two columns with a center rule, and the standings board and your-week panel sit side by side at equal height, with the tiles stretching to fill the panel. At **420px and down** tab labels tighten (14px, 4px padding). The Overall table hides its Left and TB columns when empty so it fits a 390px viewport without horizontal scroll.

The My picks / All games switch is sticky at the top of the viewport; game anchors carry a 72px scroll margin so tile links land below it.

## Elevation & Depth

Flat. There are no shadows anywhere in the build. Depth is tonal: charcoal bars on a light grey page, a lighter charcoal (`bar-2`) for header strips and the clock cell, a further step (`bar-3`) to lift your own standings row, and white hairline-bordered panels for secondary content.

### Named Rules
**The Tone Not Shadow Rule.** Lift something by stepping its tone (bar to bar-2 to bar-3, page to card), never with a drop shadow.

## Shapes

Two corner sizes do most of the work: 10px on outer objects (bugs, boards, panels, trays, the stale banner) and 7px on what nests inside them (tabs, switch segments, tiles, week-nav buttons). Links and the select use 8px. Pick chips and the "who are you" buttons are full pills. The live dot and Trends status badges are circles. Borders are 1px hairlines on panels and 1.5px on chips, tiles and picker buttons. Restyle-only Trends bars use 4-5px radii.

## Components

### Score Bug (signature)
The broadcast bar for one game. Charcoal, 58px, 10px corners, clipped. Each team cell holds an optional top-25 rank (12px, on-bar-2), the abbreviation, the spread (13px, on-bar-2) and the score; the trailing team's score dims to on-bar-2. The clock cell (bar-2) stacks quarter over time; the quarter is amber when live, on-bar-2 for a scheduled day/time. Above the bug, a "Your pick" tag names your team and spread when you picked the game.

### Chips
- **Style:** 26px pills (24px in finals), 1.5px hairline outline, transparent fill, 13px system-ui name with a 12px status icon leading.
- **State:** outline and text take good/bad (push uses ink-3) by pick status. **Your own chip is solid:** charcoal fill for no status yet, or filled good/bad/ink-2 with `on-solid` text. Friends' chips stay outlined, so yours is findable at a glance.

### Pick Tiles
44px cells, 7px corners, icon over a 12px condensed abbreviation, linking to the game. Won/lost/push use the tinted fills (good-bg, bad-bg, push-bg); a live game gets a white tile with an amber 1.5px border and a colored icon; not-started tiles are outlined in hairline with ink-2.

### Standings Board
Charcoal grid with a bar-2 header strip of 12px uppercase labels, 44px rows ruled in bar-2. Your row is lifted to bar-3 with "You · Change" beside your handle. The Overall tab renders the same material as a real table (restyle only).

### Navigation
- **Tabs:** a white tray of four equal 40px buttons, 15px condensed uppercase, ink-2 at rest, ink on hover, selected fills with sel-bg/sel-ink.
- **My picks / All games switch:** same tray and selected treatment, sticky, with a dimmed count in parentheses.
- **Week nav:** white tray, 44x40 chevron buttons (page-tint hover, 0.3 opacity when disabled), centered 18px condensed week label.

### Panels
White, 1px hairline, 10px corners, 10-14px padding. Used for your week (title, W-L, live up/down, left, tile strip, icon key), the finals list and the friend picker.

### Inputs
The only field is the Team Picks / Trends select: 40px, hairline border, 8px corners, white, 15px system-ui. Focus everywhere is a 2px ink outline offset 2px.

### Motion
Tabs, switch segments and chips cross-fade background and color over 0.15s ease-out, only under `prefers-reduced-motion: no-preference`. Nothing else animates.

## Do's and Don'ts

### Do:
- **Do** build new scoreboard content from the charcoal bar material with condensed tabular numerals.
- **Do** pair every green or red with one of the six drawn icons (check, x, up, down, dash, ring).
- **Do** keep your own pick solid and friends' picks outlined.
- **Do** use sel-bg/sel-ink for any selected tab or segment so it inverts correctly in dark.
- **Do** step tone (bar-2, bar-3) to separate or lift, and keep corners at 10px outer / 7px inner.
- **Do** keep touch targets at 40-44px.

### Don't:
- **Don't** use amber for anything but live/now state and the stale-data warning.
- **Don't** use green or red for decoration, emphasis or brand; they mean pick status.
- **Don't** use the accent blue for status, or green/red for popularity.
- **Don't** set handles in the condensed face or numerals in the sans.
- **Don't** add drop shadows.
- **Don't** treat Overall, Team Picks or Trends layouts as established patterns; they carry the tokens only and await their own redesign.
