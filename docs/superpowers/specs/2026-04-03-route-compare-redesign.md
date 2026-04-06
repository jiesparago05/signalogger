# Route Comparison Redesign

## Overview

Redesign the Route Comparison screen to use a Winner Card + Scrollable Grid layout. Replaces the crowded runner cards with a clean hero winner card and horizontal scroll for other carriers.

---

## Layout

```
[ ← Back ]
[ ROUTE COMPARISON label ]
[ Route name + trip count ]
[ Winner Hero Card — #1 carrier with trophy, dBm, activity ]
[ OTHER CARRIERS label ]
[ Horizontal scrollable cards — #2, #3, #4... ]
[ Segment Breakdown — collapsed by default ]
[ Data points note ]
```

## Components

### Winner Hero Card
- Green tinted background with green border
- Trophy emoji + "#1" badge
- Carrier name (bold, 16px)
- Activity level (e.g., "Browse + Messaging")
- Signal bar (progress bar)
- Avg dBm (large, 26px, colored)

### Other Carriers (horizontal scroll)
- Each card: min-width 120px
- Rank number (colored by activity)
- Carrier name (14px bold)
- dBm value (22px bold, colored)
- Activity badge (pill)
- Scrollable horizontally — handles any number of carriers

### Segment Breakdown
- Collapsible section — **collapsed by default**
- Same as current implementation
- Toggle arrow to expand/collapse

## Files to Modify

| File | Change |
|------|--------|
| `mobile/src/features/comparison/components/RouteComparison.tsx` | Full redesign |

## Visual Reference
Mockup: `.superpowers/brainstorm/1609-1775222268/content/route-compare-fullview.html` (Option C)
