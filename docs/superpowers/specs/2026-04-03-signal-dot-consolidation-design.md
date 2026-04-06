# Signal Dot Consolidation

## Overview

Auto-consolidate nearby signal readings on the map to reduce clutter from daily commuters traveling the same routes. Fresh readings stay individual; older readings merge into consolidated dots with averaged signal data.

**Target users:** Daily commuters whose repeated routes create overlapping dots on the map.

---

## Rules

### Consolidation Criteria
- Only consolidate readings **older than 24 hours**
- Only consolidate readings with the **same carrier AND same network type**
- Only consolidate **cellular readings** (`isWifi: false`) — WiFi readings excluded from consolidation
- Only consolidate readings within **~50 meters of each other** (same approximate location)
- Fresh readings (< 24h) always display as individual dots

### Consolidated Dot Display
- **Color:** based on average dBm of all merged readings (using existing `getSignalColor`)
- **Size:** slightly larger than individual dots (14px vs 10px)
- **Count badge:** small dark badge showing number of readings (e.g., "10×") — "×" suffix clarifies it's readings, not users
- **Glow:** subtle shadow matching the signal color

### Individual Dot Display (unchanged)
- **Color:** based on dBm
- **Size:** 10px (current)
- **No badge**

---

## Tap Interactions

### First Tap — Tooltip
A small popup appears above the tapped dot:

**For individual (fresh) reading:**
- dBm value (colored)
- Carrier · Network Type
- Timestamp

**For consolidated reading:**
- Average dBm (colored) + "avg dBm" label
- Carrier · Network Type · N readings
- Range: best to worst
- Date range (e.g., "Apr 1 — Apr 3")

Tooltip has a small arrow pointing to the dot. Tapping elsewhere dismisses it.

### Second Tap — Full Details (bottom card)
A card slides up from the bottom with:

**Header row:**
- Location name (reverse geocoded or "Near [street]")
- Carrier · Network Type · N readings
- Average dBm (large, colored)

**Signal range bar:**
- Gradient bar (green to red)
- Best and Worst labels at ends

**Reading history:**
- List of individual readings grouped by date
- Each row: date, signal bar, dBm value
- Scrollable if many readings

Tapping "Back" or swiping down dismisses the card.

---

## Consolidation Logic

### When to Consolidate
- Run consolidation on the **server** as a background job (cron)
- Process readings older than 24 hours
- Run every hour (or on-demand when querying)

### Algorithm
1. Query all readings older than 24h that are not yet consolidated
2. Group by: carrier + networkType + location grid cell (~50m resolution)
   - Grid cell: round coordinates to ~0.0005 degrees (≈50m)
   - `cellLat = Math.round(lat / 0.0005) * 0.0005`
   - `cellLng = Math.round(lng / 0.0005) * 0.0005`
3. For each group with 2+ readings:
   - Calculate: avgDbm, minDbm, maxDbm, count, date range
   - Create one consolidated record
   - Mark original readings as consolidated (don't delete — keep for history)

### Consolidated Record Schema
```javascript
{
  type: 'consolidated',
  location: { type: 'Point', coordinates: [avgLng, avgLat] },
  carrier: 'Smart',
  networkType: '4G',
  avgDbm: -82,
  minDbm: -100,
  maxDbm: -65,
  count: 10,
  firstTimestamp: '2026-04-01T...',
  lastTimestamp: '2026-04-03T...',
  readingIds: ['id1', 'id2', ...],  // references to original readings (capped at 100)
}
```

### Local Consolidation (for offline/local-first)
- Same algorithm runs client-side on local AsyncStorage data
- Consolidate local readings older than 24h before rendering
- Keeps map clean even without server

---

## Map Display Changes

### Current Flow
```
fetchData() → get all readings → render as individual dots
```

### New Flow
```
fetchData() → get fresh readings (< 24h) as individual dots
           → get consolidated readings as merged dots
           → render both on map
```

### WebView JS Changes
- New function: `addConsolidatedMarker(lat, lng, color, count)` — larger dot with count badge
- New function: `showTooltip(lat, lng, html)` — popup above dot
- New function: `hideTooltip()` — dismiss popup
- Existing `addMarker()` stays for individual dots
- Remove "signal here" button — dots handle this now

### Tap Handling
- Dot click → sends message to React Native: `{ type: 'dotTap', id, isConsolidated, lat, lng }`
- React Native shows tooltip or detail card based on tap count

---

## Files to Modify

| File | Change |
|------|--------|
| `server/services/signal-service.js` | Add consolidation query + aggregation |
| `server/workers/consolidation-worker.js` | New — background consolidation job |
| `server/models/ConsolidatedSignal.js` | New — consolidated record model |
| `mobile/src/features/map-view/hooks/use-map-data.ts` | Fetch consolidated + fresh separately |
| `mobile/src/features/map-view/components/MapScreen.tsx` | New WebView JS functions, tap handling, tooltip + detail card |
| `mobile/src/features/offline-sync/services/log-store.ts` | Local consolidation function |

---

## What's NOT in Scope
- Time filter UI (consolidation replaces this need)
- Editing/deleting individual readings from consolidated groups
- Cross-carrier consolidation (each carrier stays separate)
- Real-time consolidation (only runs on 24h+ old data)

---

## Visual Reference
Mockups saved at: `.superpowers/brainstorm/1276-1775193291/content/consolidated-dots-mockup.html`
