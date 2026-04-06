# Local-First Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make the app feel instant on any connection by storing and reading data locally first, with background server sync.

**Architecture:** Local storage (AsyncStorage) is the primary data source for the user's own data. Server provides crowd data and backup. UI never blocks on server calls.

**Tech Stack:** React Native, AsyncStorage (existing), sync-service (existing)

**Important:** After modifying any file in `mobile/src/`, copy it to the matching path in `src/`. After mobile JS changes, press `r` in Metro to reload. For release builds, copy changed files to `C:\sl\` and rebuild.

---

### Task 1: Local Route Storage

**Files:**
- Modify: `mobile/src/features/routes/hooks/use-routes.ts`

- [x] **Step 1: Add local route storage functions**

Add AsyncStorage helpers (similar to sessions):

```typescript
const ROUTES_KEY = '@signalog_routes';

async function loadLocalRoutes(): Promise<CommuteRoute[]> { ... }
async function saveLocalRoute(route: CommuteRoute): Promise<void> { ... }
```

- [x] **Step 2: Make route creation local-first**

When user saves a route:
1. Generate local `_id` (`local_${Date.now()}`)
2. Save to AsyncStorage immediately
3. Dismiss modal
4. Create on server in background (fire-and-forget)

- [x] **Step 3: Make route listing local-first**

Route list should:
1. Load from AsyncStorage first (instant)
2. Fetch from server in background
3. Merge results

- [x] **Step 4: Sync and test**

```bash
cp mobile/src/features/routes/hooks/use-routes.ts src/features/routes/hooks/use-routes.ts
```

---

### Task 2: Non-Blocking Save Route Modal

**Files:**
- Modify: `mobile/src/features/routes/components/SaveRouteModal.tsx`

- [x] **Step 1: Remove server-blocking from Save**

The "Save as New Route" button should:
1. Save locally → dismiss modal immediately
2. Server sync happens in background via use-routes hook
3. Button should never gray out waiting for server

- [x] **Step 2: Sync and test**

---

### Task 3: Map Dots from Local Storage

**Files:**
- Modify: `mobile/src/features/map-view/components/MapScreen.tsx`
- Modify: `mobile/src/features/offline-sync/services/log-store.ts`

- [x] **Step 1: Add local signal query to log-store**

Add function to query local signals by bounding box:

```typescript
async function getLocalSignals(bounds: ViewportBounds): Promise<SignalLog[]> {
  // Read all unsynced + recent synced from AsyncStorage
  // Filter by coordinates within bounds
}
```

- [x] **Step 2: Load local dots first in MapScreen**

When map viewport changes:
1. Load dots from local log-store immediately
2. Fetch server dots in background
3. Merge and deduplicate

- [x] **Step 3: Sync and test**

---

### Task 4: Trail from Local Logs

**Files:**
- Modify: `mobile/src/features/sessions/components/SessionsList.tsx`
- Modify: `mobile/src/features/map-view/components/MapScreen.tsx`
- Modify: `mobile/src/features/offline-sync/services/log-store.ts`

- [x] **Step 1: Add local trail query to log-store**

Add function to get logs for a session by time range:

```typescript
async function getLogsForSession(startTime: Date, endTime: Date): Promise<SignalLog[]> {
  // Filter local logs by timestamp range
}
```

- [x] **Step 2: Load trail from local first**

When user taps a session to view trail:
1. Query local logs by session time range → show immediately
2. Fetch from server `/sessions/:id/trail` in background → merge

- [x] **Step 3: Sync and test**

---

### Task 5: Heatmap Local Cache

**Files:**
- Modify: `mobile/src/features/map-view/components/MapScreen.tsx`

- [x] **Step 1: Cache heatmap tiles in AsyncStorage**

After fetching heatmap tiles from server:
- Save to AsyncStorage with viewport key
- On next load, show cached tiles first, fetch fresh in background

- [x] **Step 2: Graceful empty state**

When heatmap has no data (server unreachable):
- Show empty map (no tiles) instead of blocking
- Don't show error to user

- [x] **Step 3: Sync and test**

---

### Task 6: Session List Merge (Local + Server)

**Files:**
- Modify: `mobile/src/features/sessions/components/SessionsList.tsx`

- [x] **Step 1: Merge local and server sessions**

Currently falls back to local if server fails. Improve:
1. Load local sessions (instant, show immediately)
2. Fetch server sessions in background
3. Merge: deduplicate by `_id`, prefer server version if both exist
4. Update displayed list

- [x] **Step 2: Sync and test**

---

### Task 7: Cleanup and Testing

- [x] **Step 1: Remove remaining debug console.logs**
- [x] **Step 2: Test on mobile data — all features instant**
- [x] **Step 3: Test offline — map dots, sessions, routes show from local**
- [x] **Step 4: Test sync — data reaches server when connection available**
- [x] **Step 5: Build release APK and field test**
