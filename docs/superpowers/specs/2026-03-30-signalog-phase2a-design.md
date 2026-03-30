# Signalog Phase 2a — Signal History, Sessions & Commute Routes

## Overview

Phase 2a adds signal history tracking, personal mapping sessions, and saved commute routes. The core insight: Signalog is for **Filipino commuters** who experience signal drops during multi-modal transport (jeep + walk + train). The app should answer: **"Which carrier is reliable along my commute?"**

**Target user:** Filipino commuter who mixes transport modes (jeepney, bus, train, walking), uses their phone for browsing, messaging, streaming, navigation, and gaming during commute.

---

## Features

### 1. Mapping Sessions

Every Start/Stop Mapping cycle creates a session. Sessions group signal logs into trips with summary stats.

**MappingSession data model:**

```
MappingSession {
  _id: ObjectId
  deviceId: String
  startTime: Date
  endTime: Date
  startLocation: { type: "Point", coordinates: [lng, lat] }
  endLocation: { type: "Point", coordinates: [lng, lat] }
  logCount: Number
  avgDbm: Number
  minDbm: Number
  maxDbm: Number
  carrier: String
  networkType: String
  distanceMeters: Number
  stability: String ("Stable" | "Fluctuating" | "Unstable")
  routeId: ObjectId (optional — links to saved route)
  status: String ("active" | "completed")
  synced: Boolean
}
```

**Behavior:**
- `POST /api/sessions` on Start Mapping — creates session with `status: "active"`
- `PATCH /api/sessions/:id` on Stop Mapping — computes stats from logs in time range, sets `status: "completed"`
- Session stats computed client-side from the logs captured during that session
- Sessions stored locally in AsyncStorage and synced like signals/reports

### 2. Sessions List (Personal Timeline)

New tab in the bottom sheet: **Live | Sessions**

Each session card shows:
- Date + time range (e.g., "Today, 2:30 PM — 3:45 PM")
- Carrier + network type + distance (e.g., "GOMO · 4G · 1.2 km")
- Average dBm (color-coded)
- Log count
- Stability label (Stable/Fluctuating/Unstable)
- Signal range (e.g., "-70 to -100")

**API:** `GET /api/sessions/:deviceId` — returns paginated list of completed sessions

### 3. Session Detail — Map Trail + Chart

Tap a session card to see the detail view:

**Map Trail:**
- Route drawn on the map as a polyline, color-coded by signal strength at each point
- Green = excellent/good, yellow = moderate, orange = weak, red = dead zone
- Start and end markers

**Signal Chart:**
- Line graph of dBm over time for the session duration
- X-axis: time, Y-axis: dBm
- Color follows signal strength thresholds
- Rendered using SVG in a WebView or react-native-svg

**Stats Bar:**
- Best dBm | Average dBm | Worst dBm | Log count

**API:** `GET /api/sessions/:id/trail` — returns raw signal logs for that session's time range + deviceId

### 4. Saved Commute Routes

Users can save a session as a named commute route (e.g., "Bacoor → Makati"). Over time, the app aggregates signal data from multiple trips along the same route.

**CommuteRoute data model:**

```
CommuteRoute {
  _id: ObjectId
  deviceId: String
  name: String (e.g., "Bacoor → Makati")
  sessions: [ObjectId] (linked MappingSession IDs)
  segments: [{
    startLocation: { type: "Point", coordinates: [lng, lat] }
    endLocation: { type: "Point", coordinates: [lng, lat] }
    label: String (auto: "KM 0-1", user can rename to "Zapote → Coastal Rd")
    distanceMeters: Number
    avgDbm: Number
    minDbm: Number
    maxDbm: Number
    sampleCount: Number
    activityLevel: String ("gaming" | "streaming" | "browsing" | "messaging" | "dead")
  }]
  overallGrade: String ("A" | "B" | "C" | "D" | "F")
  totalTrips: Number
  createdAt: Date
  updatedAt: Date
}
```

**Behavior:**
- After stopping a mapping session, user can tap "Save as Route" to create a new commute route or "Add to Route" to link the session to an existing route
- When a session is added to a route, segments are recomputed by dividing the combined trail data into ~1km chunks
- Route grade computed from weighted average of segment activity levels
- Manual save only for Phase 2a — auto-detection deferred to future update

**API:**
- `POST /api/routes` — create new route from a session
- `PATCH /api/routes/:id/add-session` — add a session to existing route, recompute segments
- `GET /api/routes/:deviceId` — list user's saved routes
- `GET /api/routes/:id` — get route detail with segments

### 5. Route Segments with Activity Labels

Routes are broken into ~1km segments. Each segment shows what you can practically do with the signal:

| dBm Range | Activity Level | Label |
|-----------|---------------|-------|
| ≥ -75 | gaming | 📶 Gaming + Streaming + Browse |
| -75 to -85 | streaming | 📶 Streaming + Browse |
| -85 to -95 | browsing | 📶 Browse + Messaging |
| -95 to -105 | messaging | 📶 Messaging Only (slow) |
| < -105 | dead | ❌ No Data — Dead Zone |

**Route Detail UI:**
- Route name + trip count + carrier + overall grade
- List of segments with: area label, distance, activity badge, avg dBm
- Dead zone segments highlighted with red border
- Tapping a segment centers the map on that stretch

### 6. Location History (Tap-to-Query)

Tap any point on the map to see historical signal data for that area.

**SignalHistory data model (pre-aggregated):**

```
SignalHistory {
  _id: ObjectId
  gridCell: {
    sw: [lng, lat]
    ne: [lng, lat]
  }
  carrier: String
  networkType: String
  hour: Date (rounded to hour)
  avgDbm: Number
  minDbm: Number
  maxDbm: Number
  sampleCount: Number
}
```

**Aggregation:** Extend existing heatmap worker to also compute hourly signal history tiles. Runs every 15 minutes, processes new signal logs since last run.

**Location History Popup:**
- Shows all carriers that have data within 500m radius
- Each carrier row: colored dot, name, avg dBm (color-coded), log count
- "Tap a carrier for detailed hourly breakdown"
- Lookback period: 7 days default

**API:** `GET /api/history?lng=X&lat=Y&radius=500&days=7&carrier=GOMO`

---

## Architecture Changes

### Backend

1. **New models:** `MappingSession`, `CommuteRoute`, `SignalHistory`
2. **New routes:** `/api/sessions`, `/api/routes`, `/api/history`
3. **Extended worker:** heatmap aggregator also computes `SignalHistory` tiles (hourly averages per grid cell per carrier)

### Mobile App

1. **Session management:** `use-session` hook — creates/completes sessions, computes stats
2. **Sessions list:** new tab in bottom sheet with session cards
3. **Session detail screen:** map trail (polyline in Leaflet) + SVG chart
4. **Route management:** save/add sessions to routes, view route segments
5. **Location history:** tap handler on map, popup with carrier averages
6. **Activity labels:** utility function mapping dBm → activity level

### Data Flow

```
Start Mapping
  → Create MappingSession (status: "active")
  → Signal logs captured with session context

Stop Mapping
  → Compute session stats (avg/min/max dBm, distance, stability)
  → Update MappingSession (status: "completed")
  → Offer "Save as Route" / "Add to Route"

Save as Route
  → Create CommuteRoute with initial session
  → Compute segments (~1km chunks)
  → Assign activity levels per segment

Add to Route
  → Link session to existing route
  → Recompute segments with combined data

Aggregation Worker (every 15 min)
  → Process new signal logs
  → Update HeatmapTile (existing)
  → Update SignalHistory (new — hourly averages)
```

---

## What's NOT in Phase 2a

- Auto-detection of repeated routes (future)
- Carrier comparison tool (Phase 2b)
- Dead zone push notifications (Phase 2c)
- Speed test integration
- User authentication

---

## Testing Strategy

| What | How |
|------|-----|
| Session create/complete | Unit test: verify stats computation from mock logs |
| Route segment computation | Unit test: divide trail into 1km chunks, assign activity levels |
| Activity level mapping | Unit test: dBm → activity label mapping |
| History aggregation | Integration test: insert logs, run worker, verify SignalHistory tiles |
| Session trail API | Integration test: query logs by session time range |
| Map trail rendering | Manual test on device: verify polyline color-coding |
| Route UI | Manual test: save route, add sessions, verify segment updates |
