# Signalog Phase 1 — MVP Design Spec

## Overview

A crowdsourced mobile app that maps real-world signal strength and dead zones for Philippine telco carriers (Smart, Globe, TNT, GOMO, Sun, DITO). Starts as personal signal logging, with data shared to build a community signal map over time.

**Platform:** Android-first (React Native)
**Target users:** Filipino mobile users who want to check signal quality in areas they travel to, live in, or are considering moving to.

---

## Phase 1 Scope (MVP)

1. Background signal logging (smart hybrid + user-configurable)
2. Map visualization (heatmap + pin markers)
3. Manual rich reporting (categories, photos, voice notes)
4. Offline support (queue, cached map, offline reports)
5. Multi-filter by carrier + network type
6. Export data (CSV/JSON)

**Explicitly out of scope (Phase 2):**
- User profiles / leaderboard
- Push notifications / dead zone alerts
- Signal history / timeline
- Carrier comparison tool
- Authentication / login

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile app | React Native (Android-first) |
| Local database | WatermelonDB (offline-first, React Native optimized) |
| Navigation | React Navigation (bottom sheet + stack) |
| Maps | Mapbox React Native SDK |
| Backend API | Node.js + Express |
| Database | MongoDB with geospatial indexes |
| File storage | Local filesystem (MVP), S3 (future) |
| Background worker | Node.js cron job (aggregation) |

---

## Data Model

### SignalLog

The core reading captured by background logging.

```
SignalLog {
  _id: ObjectId
  timestamp: Date
  location: {
    type: "Point"
    coordinates: [lng, lat]
    accuracy: Number (meters)
    altitude: Number (optional)
  }
  carrier: String ("Smart", "Globe", "TNT", "GOMO", "Sun", "DITO")
  networkType: String ("2G", "3G", "4G", "5G", "none")
  signal: {
    dbm: Number
    rssi: Number (optional)
    snr: Number (signal-to-noise ratio, optional)
    cellId: String (optional)
    bandFrequency: Number (optional, MHz)
  }
  connection: {
    downloadSpeed: Number (Mbps, optional)
    uploadSpeed: Number (Mbps, optional)
    ping: Number (ms, optional)
    isWifi: Boolean
  }
  deviceId: String (anonymous device identifier)
  synced: Boolean (false until uploaded to server)
}
```

**Indexes:**
- `location` — 2dsphere index for geospatial queries
- `carrier` + `networkType` — compound index for filtering
- `timestamp` — for time-range queries
- `deviceId` + `synced` — for sync service queries

### ManualReport

User-submitted reports with optional attachments.

```
ManualReport {
  _id: ObjectId
  timestamp: Date
  location: { type: "Point", coordinates: [lng, lat] }
  carrier: String
  networkType: String
  category: String ("dead_zone", "weak_signal", "intermittent", "slow_data")
  note: String (optional, max 500 chars)
  attachments: [{
    type: String ("photo", "voice_note")
    url: String
    size: Number
  }]
  deviceId: String
  synced: Boolean
}
```

### HeatmapTile

Pre-computed by the aggregation worker.

```
HeatmapTile {
  _id: ObjectId
  bounds: { sw: [lng, lat], ne: [lng, lat] }
  zoomLevel: Number
  carrier: String (or "all")
  networkType: String (or "all")
  avgDbm: Number
  dataPointCount: Number
  lastUpdated: Date
}
```

---

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                  REACT NATIVE APP                    │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Signal   │  │ Map      │  │ Manual Report     │  │
│  │ Logger   │  │ View     │  │ (rich reporting)  │  │
│  │ Service  │  │ (Mapbox) │  │                   │  │
│  └────┬─────┘  └────┬─────┘  └────────┬──────────┘  │
│       │              │                 │             │
│  ┌────▼──────────────▼─────────────────▼──────────┐  │
│  │           WATERMELONDB (LOCAL)                  │  │
│  │  (offline queue + cached data + logs)          │  │
│  └────────────────────┬───────────────────────────┘  │
│                       │                              │
│  ┌────────────────────▼───────────────────────────┐  │
│  │              SYNC SERVICE                      │  │
│  │  (batch upload when online, retry on failure)  │  │
│  └────────────────────┬───────────────────────────┘  │
└───────────────────────┼──────────────────────────────┘
                        │
                   ─────▼─────
                  │  EXPRESS  │
                  │  API      │
                   ─────┬─────
                        │
          ┌─────────────┼─────────────┐
          │             │             │
    ┌─────▼─────┐ ┌─────▼─────┐ ┌────▼─────┐
    │  MongoDB  │ │  File     │ │  Agg     │
    │  (geo-    │ │  Storage  │ │  Worker  │
    │  indexed) │ │  (photos, │ │  (cron)  │
    │           │ │  voice)   │ │          │
    └───────────┘ └───────────┘ └──────────┘
```

### Key Architecture Decisions

- **WatermelonDB** for local storage — built for React Native, handles sync patterns well, lazy-loads records for performance.
- **Sync Service** batches uploads (max 100 signal logs per request, or every 5 minutes) to avoid hammering the API. Exponential backoff on failure (1s → 2s → 4s → max 60s).
- **Aggregation Worker** runs as a cron job every 15 minutes, pre-computes heatmap tiles by carrier/network type/zoom level. Keeps the API fast for map queries.
- **File Storage** for photos and voice notes — local filesystem for MVP, migrates to S3 for production.
- **No auth for MVP** — devices are identified by anonymous `deviceId` (UUID generated on first launch, stored locally).

---

## Mobile App — Screens & Navigation

### Navigation: Map + Bottom Sheet (Option C)

Full-screen map as the home screen with a draggable bottom sheet. The collapsed sheet shows live signal data. Swipe up reveals Logger dashboard, settings, and more. Report is a floating action button.

### Screens

**1. Map Screen (Home)**
- Full-screen Mapbox map
- Heatmap overlay when zoomed out (color-coded: green = strong, yellow = moderate, red = weak/dead)
- Pin markers when zoomed in, tappable for signal details
- Filter chips at top for carrier (Smart, Globe, TNT, GOMO, Sun, DITO) and network type (2G, 3G, 4G, 5G)
- Multi-select: toggle multiple carriers and network types on/off
- Collapsed bottom sheet shows: current dBm, carrier, network type, ping, logging status

**2. Bottom Sheet — Expanded**
- Logger dashboard: real-time signal metrics (dBm, RSSI, SNR, cell ID, band frequency, download/upload speed, ping)
- Logging toggle (on/off)
- Logging mode selector (Smart Hybrid / Time-based / Distance-based)
- Interval/distance configuration sliders
- Offline queue status (X logs pending sync)

**3. Manual Report (Modal/Overlay)**
- Triggered by floating action button (+)
- Category selection: Dead Zone, Weak Signal, Intermittent, Slow Data
- Auto-captures: location, carrier, network type, current signal strength
- Optional note field (max 500 chars)
- Photo attachment (camera or gallery)
- Voice note attachment (record in-app)
- Submit button (works offline — queues for sync)

**4. Settings (section within expanded bottom sheet, accessed by scrolling down past Logger dashboard)**
- Logging mode configuration
- Stationary interval slider (10s – 5min, default 30s)
- Moving distance slider (10m – 500m, default 50m)
- Battery saver toggle (reduce frequency when < 20%)
- Export data (CSV or JSON)
- Clear local data
- About / version

---

## API Endpoints

```
POST   /api/signals/batch      — Upload batch of signal logs (array of SignalLog)
GET    /api/signals             — Query signals by viewport bounds + carrier + networkType filters
GET    /api/heatmap/tiles       — Get pre-computed heatmap tiles for viewport + zoom level + filters
POST   /api/reports             — Submit manual report (JSON body)
GET    /api/reports             — Query reports by viewport bounds + filters
POST   /api/reports/upload      — Upload photo/voice attachment (multipart/form-data)
GET    /api/carriers            — List available carriers (static for MVP)
GET    /api/export/:deviceId    — Export device's own data as CSV or JSON (query param: format=csv|json)
```

### Query Parameters for Geospatial Endpoints

```
?sw_lng=120.9&sw_lat=14.5&ne_lng=121.1&ne_lat=14.7  — viewport bounds
&carrier=Smart,Globe                                   — comma-separated carrier filter
&networkType=4G,5G                                     — comma-separated network type filter
&zoom=12                                               — zoom level (for heatmap tile granularity)
```

---

## Offline Strategy

1. **Local DB (WatermelonDB)** — all signal logs and reports stored locally first with `synced: false`
2. **Map tile cache** — Mapbox SDK's built-in offline tile caching for last viewed region
3. **Sync service** activates when connectivity returns:
   - Batches signal logs (max 100 per request)
   - Uploads reports, then uploads attachments separately
   - Exponential backoff on failure (1s → 2s → 4s → max 60s)
   - Marks records `synced: true` after server confirms receipt
4. **Conflict resolution** — server wins. Signal data is append-only (no edits). Reports are immutable after submission.
5. **Manual reports work fully offline** — category, note, photo, and voice note are all stored locally and synced later.

---

## Background Logging — Smart Hybrid

### Default Behavior
- **Stationary mode** — device GPS shows < 5m movement over 10 seconds → log every 30 seconds
- **Moving mode** — device is moving → log every 50 meters of displacement

### Motion Detection
- Use accelerometer data to detect stationary vs moving state (not continuous GPS polling)
- Switch modes with a 10-second debounce to avoid rapid toggling

### Battery Optimization
- Use Android's `FusedLocationProvider` for efficient GPS access
- Use `react-native-background-actions` for persistent background service
- When battery < 20%: double the logging interval (60s stationary, 100m moving)
- When battery < 10%: pause logging, show notification to user

### User Configuration
- Logging mode: Smart Hybrid (default) / Time-only / Distance-only
- Stationary interval: 10 seconds – 5 minutes (slider)
- Moving distance: 10 meters – 500 meters (slider)
- Battery saver toggle: on/off

---

## Signal Data Collection

### What We Capture

| Field | Source | Required |
|-------|--------|----------|
| Signal strength (dBm) | `TelephonyManager.getSignalStrength()` | Yes |
| Network type (2G/3G/4G/5G) | `TelephonyManager.getNetworkType()` | Yes |
| Carrier name | `TelephonyManager.getNetworkOperatorName()` | Yes |
| GPS coordinates | `FusedLocationProvider` | Yes |
| GPS accuracy | `FusedLocationProvider` | Yes |
| RSSI | `CellSignalStrength` | Optional |
| SNR (signal-to-noise) | `CellSignalStrength` | Optional |
| Cell tower ID | `CellInfo.getCellIdentity()` | Optional |
| Band frequency | `CellIdentity.getChannelNumber()` | Optional |
| Download speed | On-demand speed test (manual trigger) | Optional |
| Upload speed | On-demand speed test (manual trigger) | Optional |
| Ping | On-demand speed test (manual trigger) | Optional |
| WiFi status | `ConnectivityManager` | Yes |

**Note:** Speed tests (download/upload/ping) are NOT run automatically in background — they consume data and battery. They are only captured when the user manually triggers a speed test from the Logger dashboard.

---

## Export Feature

- User taps "Export Data" in Settings
- Chooses format: CSV or JSON
- App queries local WatermelonDB for all records matching `deviceId`
- Generates file and triggers Android share sheet (save to files, email, etc.)
- CSV format includes headers matching SignalLog fields
- JSON format is an array of SignalLog objects

---

## Testing Strategy

| Layer | Tool | What |
|-------|------|------|
| Unit | Jest | Services (signal parser, sync logic, heatmap aggregation, data export) |
| Integration | Jest + MongoDB Memory Server | API endpoints with real MongoDB |
| E2E | Detox | Critical flows: open app → see map → submit report → verify in DB |
| Geospatial | Jest | Verify heatmap tile queries return correct data for given bounds and filters |

---

## Project Structure

```
signalogger/
├── src/
│   ├── components/ui/              # Shared UI primitives
│   ├── features/
│   │   ├── signal-logging/         # Background signal capture
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── types/
│   │   ├── map-view/               # Map visualization + heatmap + pins
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── types/
│   │   ├── manual-report/          # Rich manual reporting
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── types/
│   │   └── offline-sync/           # Offline queue + sync service
│   │       ├── components/
│   │       ├── hooks/
│   │       ├── services/
│   │       └── types/
│   ├── lib/
│   │   ├── api/                    # API client (Express backend calls)
│   │   ├── config/                 # Environment variables, constants
│   │   └── utils/                  # Pure utility functions
│   ├── types/                      # Shared type definitions
│   └── styles/                     # Global styles, theme
├── server/
│   ├── routes/                     # Express route handlers
│   ├── models/                     # Mongoose schemas
│   ├── services/                   # Business logic
│   ├── workers/                    # Aggregation worker (cron)
│   └── config/                     # Server config, DB connection
├── docs/
│   ├── superpowers/specs/          # Design specs
│   └── decisions/                  # Architecture Decision Records
├── scripts/                        # Build scripts, automation
├── tests/                          # Test files
├── CLAUDE.md
├── .env.example
├── package.json
└── README.md
```

---

## Phase 2 Roadmap (Post-MVP)

After launch and real user feedback:

1. **Signal history / timeline** — see how signal quality changed at a location over time
2. **Carrier comparison tool** — side-by-side stats for an area
3. **User profiles / leaderboard** — top contributors, badges
4. **Push notifications** — "you're entering a known dead zone" (geofencing)
5. **Authentication** — optional accounts for cross-device sync
