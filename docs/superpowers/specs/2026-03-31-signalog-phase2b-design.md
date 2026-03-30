# Signalog Phase 2b — Carrier Comparison Tool

## Overview

A carrier comparison tool that answers: **"Which carrier is best for my commute / my location / this area?"** Uses crowdsourced signal data from Phase 2a's SignalHistory tiles to rank carriers by signal strength and show practical activity labels (Gaming, Streaming, Browse, Messaging, Dead).

**Target users:** Filipino commuters deciding which carrier/SIM to use, or evaluating signal quality across carriers at a specific location.

---

## Features

### 1. Route-Based Comparison (Primary)

Compare all carriers along a saved commute route. Accessed from the Routes tab → tap a route → "Compare Carriers" button.

**UI — Two sections:**

**Top: Carrier Ranking**
- Featured #1 card with carrier name, avg dBm, activity label
- Runner-up cards (#2, #3, etc.) as smaller cards side by side
- Based on average signal across the entire route corridor

**Bottom: Segment Breakdown (expandable)**
- Table with place name labels (e.g., Bacoor, Zapote, Coastal, Makati) as rows
- Columns per carrier (Smart, Globe, GOMO, DITO, etc.)
- Each cell shows activity level badge (Game/Stream/Browse/Msg/Dead)
- Dead zone rows highlighted in red
- Data note: "Based on X crowdsourced data points"

**Data source:** Query SignalHistory tiles along the route corridor (~1km buffer around each segment). Group by carrier, compute average dBm per segment per carrier.

### 2. Current Location Comparison

**"Compare Carriers Here" button** in the Live tab of bottom sheet. One tap → uses GPS → shows carrier ranking popup for your current location.

**Tap-on-map popup** — tap any spot on the map → same carrier comparison popup showing rankings for that area (500m radius, last 7 days).

**Popup UI:**
- Title: "Signal Here" with coordinates
- Subtitle: "500m radius · Last 7 days"
- List of carriers ranked by avg dBm
- Each row: carrier color dot, name, activity badge, avg dBm
- Based on SignalHistory data

### 3. Area Search

Search bar at the top of the map screen. Type an area name (e.g., "Makati", "SM Mall of Asia") → autocomplete suggestions → select → map centers on location → carrier comparison popup appears.

**Implementation:** Use a geocoding API to convert place names to coordinates. Options:
- Nominatim (free, OpenStreetMap-based) — for MVP
- Google Places API — better autocomplete but requires API key

For MVP, use Nominatim (free, no API key needed). Rate limit: max 1 request/second — debounce search input to 1s.

---

## API

### New Endpoints

```
GET /api/compare/route/:routeId
```

Returns carrier rankings and per-segment breakdown for a route.

Response:
```json
{
  "ranking": [
    { "carrier": "Smart", "avgDbm": -72, "activityLevel": "gaming", "sampleCount": 450 },
    { "carrier": "Globe", "avgDbm": -81, "activityLevel": "streaming", "sampleCount": 320 }
  ],
  "segments": [
    {
      "label": "KM 0-1",
      "carriers": [
        { "carrier": "Smart", "avgDbm": -68, "activityLevel": "gaming" },
        { "carrier": "Globe", "avgDbm": -79, "activityLevel": "streaming" },
        { "carrier": "GOMO", "avgDbm": -95, "activityLevel": "browsing" }
      ]
    }
  ],
  "totalDataPoints": 1240
}
```

Logic: For each route segment, query SignalHistory tiles within ~0.01° of the segment center. Group by carrier, compute averages.

```
GET /api/compare/location?lng=X&lat=Y&radius=500&days=7
```

Returns carrier rankings for a point. Reuses the existing `history-service.queryByLocation()` with activity level labels added.

Response:
```json
{
  "data": [
    { "carrier": "Smart", "avgDbm": -68, "activityLevel": "gaming", "sampleCount": 120 },
    { "carrier": "Globe", "avgDbm": -79, "activityLevel": "streaming", "sampleCount": 85 }
  ],
  "count": 3
}
```

### No New Models

All comparison data comes from existing `SignalHistory` tiles (computed by Phase 2a aggregator worker). No new database collections needed.

---

## Mobile App Changes

### New Files

| File | Purpose |
|------|---------|
| `src/features/comparison/components/RouteComparison.tsx` | Full-screen route comparison view (ranking + segments) |
| `src/features/comparison/components/LocationComparison.tsx` | Carrier comparison popup for a location |
| `src/features/comparison/components/SearchBar.tsx` | Area search with autocomplete using Nominatim |
| `src/features/comparison/hooks/use-comparison.ts` | Fetch comparison data from API |

### Modified Files

| File | Change |
|------|--------|
| `src/features/routes/components/RouteDetail.tsx` | Add "Compare Carriers" button |
| `src/features/map-view/components/MapScreen.tsx` | Add Compare Here button in Live tab, tap-on-map handler, SearchBar, LocationComparison popup |
| `src/lib/api/client.ts` | Add `api.compare.route()` and `api.compare.location()` methods |

### Backend New Files

| File | Purpose |
|------|---------|
| `server/routes/compare.js` | Comparison API endpoints |
| `server/services/compare-service.js` | Comparison query logic |

### Backend Modified Files

| File | Change |
|------|--------|
| `server/app.js` | Register compare router |

---

## Data Flow

```
Route Comparison:
  RouteDetail → "Compare Carriers" button
    → GET /api/compare/route/:routeId
    → Server queries SignalHistory tiles along route segments
    → Groups by carrier, computes avg per segment
    → Returns ranking + segment breakdown
    → RouteComparison screen renders cards + table

Location Comparison:
  "Compare Here" button OR tap on map
    → GET /api/compare/location?lng=X&lat=Y
    → Server queries SignalHistory tiles in radius
    → Groups by carrier, sorts by avgDbm
    → Returns ranked carrier list
    → LocationComparison popup renders

Area Search:
  SearchBar → user types area name
    → GET https://nominatim.openstreetmap.org/search?q=Makati&format=json
    → Autocomplete suggestions appear
    → User selects → map centers → location comparison popup
```

---

## What's NOT in Phase 2b

- User authentication
- Historical trend charts (signal over days/weeks per carrier)
- Carrier switching recommendations
- Cost/plan comparison (data plans, pricing)
- Dead zone alerts (Phase 2c)

---

## Testing Strategy

| What | How |
|------|-----|
| Route comparison API | Integration test: create route with segments, insert SignalHistory data for multiple carriers, verify ranking + segment breakdown |
| Location comparison API | Integration test: insert SignalHistory, query by location, verify carrier grouping |
| Activity level mapping | Unit test: verify dBm → activity level conversion |
| Search bar | Manual test: type area name, verify autocomplete, select, verify map centers |
| Route comparison UI | Manual test on device: open route, tap Compare, verify ranking + segments |
| Location popup | Manual test: tap map spot, verify popup with carrier data |
| Compare Here button | Manual test: tap button, verify GPS used, popup shows |
