# Phase 3 — Local-First Architecture

## Overview

Refactor the app so all user data is stored locally first and displayed instantly, with background sync to the server. The app should feel fast and responsive on any connection — mobile data, WiFi, or completely offline.

**Target users:** Filipino commuters on mobile data where server round-trips are slow and unreliable.

**Principle:** Local storage is the source of truth for the user's own data. Server is for crowdsourced data and backup.

---

## Current Problems

1. **Start/Stop Mapping** blocks UI waiting for server session create/complete
2. **Save as Route** grays out while waiting for server response
3. **Sessions tab** shows empty when server is unreachable
4. **Signal dots on map** only load from server — blank on slow connections
5. **Trail view** only loads from server — blank on slow connections
6. **Heatmap** only loads from server — blank on slow connections

---

## Architecture

```
Mobile App
│
├── Local Storage (AsyncStorage) ← PRIMARY for user's own data
│   ├── sessions (already done)
│   ├── routes (TODO)
│   ├── signal logs (already in log-store)
│   └── sync queue (already exists)
│
├── UI (reads local first, enhances with server data)
│   ├── Map dots → local logs + server crowd data
│   ├── Sessions tab → local sessions + server merge
│   ├── Routes tab → local routes + server merge
│   ├── Trail view → local logs for session
│   └── Heatmap → server only (crowd data)
│
└── Background Sync (non-blocking)
    ├── Upload: local unsynced → server
    └── Download: server crowd data → local cache
```

---

## Data Flow

### Signal Logging (already works)
1. Signal reading captured → saved to AsyncStorage (log-store) instantly
2. Background sync uploads batches to server
3. Each log has `synced: false` → `true` after upload

### Sessions (partially done)
1. Start Mapping → create session in AsyncStorage instantly → start logging
2. Stop Mapping → compute stats locally → save to AsyncStorage → show Save Route prompt
3. Background: create/update session on server
4. Sessions tab: load from AsyncStorage first, merge server data when available

### Routes (TODO)
1. User taps "Save as New Route" → save to AsyncStorage instantly → dismiss modal
2. Background: create route on server
3. Routes tab: load from AsyncStorage first, merge server data when available

### Map Dots (TODO)
1. On map load: show dots from local log-store (user's own data) immediately
2. Background: fetch server dots for visible area (crowd data)
3. Merge: local dots + server dots (deduplicate by _id)

### Trail View (TODO)
1. User taps session → load logs from local log-store by sessionId/timestamp range
2. If local logs found → show immediately
3. Background: fetch from server trail endpoint → merge if more data

### Heatmap (keep as-is)
1. Heatmap is aggregated crowd data — server-only is fine
2. Show "Loading..." or empty state gracefully when slow
3. Cache last heatmap tiles locally for instant redisplay

---

## Sync Status Tracking

Each record type has a `synced` field:

```typescript
{
  _id: 'local_1234567890',  // local prefix for unsynced
  synced: false,             // not yet on server
  // ... data
}
```

After successful server upload:
```typescript
{
  _id: '69cd358257c192f9a994d8dd',  // server _id
  synced: true,
}
```

---

## Merge Strategy

When loading data for display:
1. Load local data first (instant)
2. Fetch server data in background
3. Merge: server records override local if same `_id`
4. New server records (from other users) get added
5. Local-only records (unsynced) stay as-is

---

## Deployment

- **Backend:** Render Starter plan ($7/mo) — https://signalogger.onrender.com
- **Database:** MongoDB Atlas (free M0, Singapore region)
- **API client:** 60-second timeout + auto wake-up ping on app start
- **Release builds:** Signed APK, network security config for SSL
- **Native signal:** SignalStrength API (primary) + CellInfo API (fallback)
- **Location:** Google Play Services with GPS → network fallback

## Implementation Status

| Component | Status |
|-----------|--------|
| Signal log-store (AsyncStorage) | Done |
| Sync service with retry/backoff | Done |
| `synced` flag on records | Done |
| Sessions saved locally | Done (2026-04-01) |
| Session start/complete non-blocking | Done (2026-04-01) |
| API client with timeout + wake-up | Done (2026-04-01) |
| Routes saved locally | Done (2026-04-01) |
| Routes tab reads local first | Done (2026-04-01) |
| Save Route modal non-blocking | Done (2026-04-01) |
| Map dots from local log-store | Done (2026-04-01) |
| Trail from local logs | Done (2026-04-01) |
| Heatmap in-memory cache | Done (2026-04-01) |
| Session list merge (local + server) | Done (2026-04-01) |

---

## UX Rules

1. **Never block UI for server** — show local data, enhance with server
2. **Never show "Loading..." for user's own data** — it's already local
3. **"Loading..." is OK for crowd data** — user understands others' data needs internet
4. **Sync failures are silent** — retry in background, don't bother user
5. **Sync status visible in settings** — "3 items pending sync" for transparency
