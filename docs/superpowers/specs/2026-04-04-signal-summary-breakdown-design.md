# Signal Summary Breakdown & Tap-to-Map

## Overview

Enhance the Signal Summary card (shown when double-tapping a consolidated dot) with a per-reading breakdown, ungrouped dot visualization, and interactive tap-to-map navigation. The card renders as a bottom sheet (matching the session overlay style). Only consolidated dots (2+ merged readings) support this feature — fresh individual dots (< 24h) only show tooltips.

**Target:** Consolidated dots on the map (2+ merged readings).

---

## Changes

### 1. Signal Breakdown Section

Add a "Signal Breakdown" section below the existing signal range bar in the Signal Summary card.

**Each row shows:**
- **Timestamp** — formatted as `MMM D, h:mma` (e.g., "Apr 3, 2:15p")
- **Signal bar** — horizontal bar, width normalized: `(dbm + 120) / 70` clamped to 0–1 (maps -120 dBm → 0%, -50 dBm → 100%), colored by `getSignalColor(dbm)`
- **dBm value** — numeric, colored by signal quality
- **Activity badge** — pill showing what the signal supports: Game, Stream, Browse, Msg, Dead (reuses `ACTIVITY_SHORT` from shared utility)

**Initial display:** Show the latest 5 readings, sorted newest first. If more exist, show a "Show all (N)" text button below the list. Tapping it expands to a scrollable list (max 50 rows rendered for performance).

### 2. Ungrouped Dots on Map

When the Signal Summary card opens, the consolidated dot "ungroups" — individual reading dots appear on the map at their exact GPS locations.

**On open:**
- All existing dots/markers hide from the map
- Individual readings render as separate circle markers (8px, signal-colored, semi-transparent)
- Map fits bounds to show all ungrouped dots with padding

**On tap reading row:**
- Selected dot grows (14px) with white 3px border and full opacity
- Other ungrouped dots shrink (6px) and dim (30% opacity)
- Map pans/zooms to center on selected reading: `map.setView([lat, lng], Math.max(map.getZoom(), 17), { animate: true })`

**Range bar marker:**
- White vertical marker appears on the gradient bar at the position corresponding to the selected reading's dBm

Only rows with valid coordinates are tappable. Rows without coordinates render normally but are not interactive.

### 3. Fresh Dots — No Signal Summary

Fresh individual dots (< 24h, not consolidated) only support single-tap tooltips. Double-tapping a fresh dot re-shows the tooltip — it does NOT open the Signal Summary card. Only consolidated dots open the Signal Summary on double-tap.

### 4. Bottom Sheet Placement

The Signal Summary card renders as a bottom sheet (matching the session overlay):
- Position: absolute bottom, full width
- Height: 55% of window height
- Border radius: 20px top corners
- Scrollable content with fixed Close button at bottom
- Handle bar at top

When the Signal Summary card opens:
- The main bottom sheet (Live/Sessions/Routes tabs) hides
- Save current map center and zoom level

When the Signal Summary card closes:
- Bottom sheet returns
- Map restores to saved center + zoom
- Ungrouped dots clear, all original dots restore
- `updateOverlays` resumes normal behavior

### 5. Data Loading (Lazy)

Consolidated records store `readingIds` (array of original reading IDs). When the Signal Summary card opens:

1. **Try local first** — `getLocalReadingsByIds(ids)` checks AsyncStorage (instant for local consolidated dots)
2. **Fall back to server** — `GET /api/signals/readings?ids=id1,id2,...` if local found nothing
3. Show skeleton rows (3 placeholder rows with pulsing animation) while fetching
4. Cache the fetched readings in component state — don't refetch if the same dot is tapped again
5. If both local and server fail, show "Readings unavailable offline" in place of the breakdown rows. The header + range bar still work from consolidated data.

**Server endpoint:**
```
GET /api/signals/readings?ids=id1,id2,id3,...
Response: { readings: [{ _id, location, timestamp, dbm, carrier, networkType, connectionType, ... }], count: N }
```

Cap at 100 reading IDs per request (matches the `readingIds` cap in consolidated records).

### 6. Local Consolidated Dot Support

Local consolidated dots (computed from AsyncStorage) now include:
- `_id` — stable ID based on grid cell key (prefixed with `local_`)
- `readingIds` — array of original signal `_id` values (capped at 100)

This allows the breakdown to load readings from AsyncStorage without needing the server.

---

## Interaction Flow

```
1st tap on fresh dot          → Tooltip (no double-tap behavior)
1st tap on consolidated dot   → Tooltip (unchanged)
2nd tap on consolidated dot   → Save map state → Hide all dots → Hide bottom sheet
                              → Show Signal Summary card → Fetch readings
                              → Show ungrouped reading dots on map
Tap reading row               → Highlight dot + dim others + pan map + show range marker
Tap another row               → Move highlight + update range marker
Tap "Close"                   → Remove ungrouped dots → Restore all dots → Restore map → Show bottom sheet
Tap outside card              → Same as Close
```

---

## Signal Bar Scale

Normalize dBm to a 0–1 range for bar width:

```ts
const normalized = Math.max(0, Math.min(1, (dbm + 120) / 70));
// -120 dBm → 0% width, -50 dBm → 100% width
```

This range covers practical cellular signal values. Anything below -120 shows as empty, anything above -50 shows as full.

---

## Activity Level Mapping

Shared utility (`lib/utils/activity-levels.ts`):

| dBm Range       | Activity Level | Badge  | Color   |
|-----------------|---------------|--------|---------|
| > -75           | gaming        | Game   | #22C55E |
| -75 to -85      | streaming     | Stream | #84CC16 |
| -85 to -95      | browsing      | Browse | #EAB308 |
| -95 to -105     | messaging     | Msg    | #F97316 |
| < -105          | dead          | Dead   | #EF4444 |

`ACTIVITY_COLORS` and `ACTIVITY_SHORT` consolidated into shared utility (removed from RouteComparison and LocationComparison duplicates).

---

## WebView JS Functions

| Function | Purpose |
|----------|---------|
| `hideDots()` | Remove all markers/circles from map (keep in memory) |
| `showDots()` | Re-add all markers/circles to map |
| `showUngroupedReadings(readings)` | Render individual reading dots from a consolidated group |
| `clearUngroupedReadings()` | Remove ungrouped reading dots |
| `highlightUngroupedReading(idx, lat, lng, color)` | Highlight selected, dim others, pan map |
| `highlightReading(lat, lng, color)` | Legacy — used by Session Detail |
| `getMapState()` | Return current map center + zoom as JSON |
| `restoreMapState(lat, lng, zoom)` | Clear highlights, restore dots, pan to saved state |

---

## Files Modified

| File | Change |
|------|--------|
| `mobile/src/lib/utils/activity-levels.ts` | Added `ACTIVITY_COLORS`, `ACTIVITY_SHORT` exports |
| `mobile/src/features/comparison/components/RouteComparison.tsx` | Import from shared utility instead of local constants |
| `mobile/src/features/comparison/components/LocationComparison.tsx` | Import from shared utility instead of local constants |
| `server/services/signal-service.js` | Added `getReadingsByIds(ids)` query |
| `server/routes/signals.js` | Added `GET /signals/readings?ids=...` endpoint |
| `mobile/src/lib/api/client.ts` | Added `api.signals.fetchReadingsByIds(ids)` |
| `mobile/src/features/map-view/hooks/use-map-data.ts` | Added `fetchReadings` with local-first + cache, `clearBreakdown` |
| `mobile/src/features/map-view/components/MapScreen.tsx` | Breakdown UI, ungrouped dots, tap-to-map, bottom sheet hide/show, map state save/restore |
| `mobile/src/features/offline-sync/services/log-store.ts` | Added `_id`, `readingIds` to local consolidated, `getLocalReadingsByIds()` |

All `mobile/src/` changes mirrored to `src/` per architecture rule.

---

## What's NOT in Scope

- Changing the tooltip (1st tap) behavior
- Consolidation logic changes (stays the same)
- Editing or deleting individual readings from the breakdown

---

## Future Improvements

- **Smart map restore** — Track whether the user manually panned/zoomed while the Summary card was open. If they did, don't force-restore the original map view on close. Only restore if the only map movement was from tap-to-map interactions.
- **Offline reading breakdown** — Cache fetched readings in AsyncStorage so the breakdown works offline for previously viewed consolidated dots.
- **Time-of-day grouping** — Group readings by time slot (morning/afternoon/evening) to show signal patterns throughout the day at that location.
- **Daily averages view** — Collapse readings into per-day averages for dots with many readings, with expand to see individual readings per day.
- **Edit/delete readings** — Allow users to remove bad readings (e.g., indoor readings that skew outdoor averages) from a consolidated group.
