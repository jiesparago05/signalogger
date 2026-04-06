# Session Detail Screen Redesign

## Overview

Redesign the Session Detail bottom sheet that appears when a user taps a session from the Sessions tab. The current screen has wasted space, disconnected elements, and a hidden signal log section.

**Goal:** Make it feel like a polished "Trip Summary" screen with a clear flow: Summary → Signal Readings → Action.

---

## Layout Structure

```
[ MAP with trail (top, unchanged) ]

[ ← Sessions (back button) ]
[ TRIP SUMMARY label ]
[ Title + avg dBm ]
[ Date · Duration · Distance · Logs ]
[ Best | Avg | Worst stats row ]
[ Carrier · Network · Stability chips ]
[ SIGNAL READINGS label ]
[ Log list with progress bars (paginated, 20 per page) ]
[ Load More button (if more readings) ]
[ Save as Route button ]
```

---

## Components

### 1. Back Button
- Green text: "← Sessions"
- Taps back to session list

### 2. Trip Summary Section
- Small uppercase label: "TRIP SUMMARY" (gray, 9px, letter-spaced)
- Title row: location names (bold, white, 15px) + avg dBm (green, 22px, right-aligned)
- Subtitle: date · duration · distance · log count (gray, 11px)
- Stats card: Best / Avg / Worst in a dark card (`#1F2937`) with dividers
  - Best = green, Avg = yellow, Worst = red
  - 15px bold values, 9px labels
- Chips row (centered): carrier chip, network type chip, stability chip
  - Stability chip color matches label (green/yellow/red)
  - All chips: 10px text, `#1F2937` background, 6px border-radius

### 3. Signal Readings Section
- Small uppercase label: "SIGNAL READINGS" (gray, 9px, letter-spaced)
- Dark card (`#1F2937`, 10px border-radius) containing reading rows
- Each reading row:
  - Timestamp (gray, 11px, 62px fixed width, tabular-nums)
  - Signal bar (flex:1, 4px height, colored by signal strength)
  - dBm value (colored, 12px bold, 40px fixed width, right-aligned)
- Bar color logic: use `getSignalColor(dbm)` — same as map dots
- Bar width: proportional to signal strength (0 dBm = 100%, -130 dBm = 0%)
- Rows separated by `#293548` border (1px)
- **Pagination:** Show 20 readings initially
  - If more readings exist, show "Load More" button below the list
  - "Load More" button: gray text, centered, tapping loads next 20
  - Button text: "Load More (X remaining)"

### 4. Save as Route Button
- Only shown if session has no `routeId`
- Green background (`#22C55E`), white bold text, 10px border-radius
- Text: "📍 Save as Route"
- Attached to content flow (not floating/sticky)
- Padding: 14px horizontal, 13px vertical

---

## Data Source

- **Session metadata** (title, stats, carrier): from `MappingSession` object passed as prop
- **Signal readings**: loaded from local `log-store` via `getLogsByTimeRange(startTime, endTime)`
  - Falls back to server `api.sessions.getTrail()` if local is empty
  - Local-first pattern: show local immediately, enhance with server data in background
- **Pagination state**: `page` counter, `PAGE_SIZE = 20`, slice the readings array

---

## Changes from Current Design

| Current | New |
|---------|-----|
| Empty space between stats and carrier info | Filled with Signal Readings list |
| Carrier/network/stability as plain text | Styled as chips (pill badges) |
| No section labels | "Trip Summary" and "Signal Readings" labels |
| No individual readings visible | Full scrollable log list with progress bars |
| Save as Route floating at bottom | Attached to content flow |
| Loading state blocks entire view | Local data shows instantly |

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/src/features/sessions/components/SessionDetail.tsx` | Full redesign — new layout, readings list, pagination |

No new files needed. The `getLogsByTimeRange` function in `log-store.ts` already exists.

---

## Visual Reference

Mockup saved at: `.superpowers/brainstorm/2461-1775068735/content/session-detail-c-refined.html`
