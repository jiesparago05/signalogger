# Background Logger Survival

## Overview

The background signal logging service gets killed by Android during long mapping sessions (50+ minutes), even with only Signalogger open. The session UI stays alive but signal capture stops silently, resulting in 0 logs for an entire session.

**Root causes:**
1. `stopWithTask="true"` in AndroidManifest — foreground service dies when Android terminates the app task
2. `signalCache` in log-store.ts grows unbounded — all logs kept in memory without trimming
3. `logsRef` in use-session.ts accumulates all session logs in memory — never trimmed during recording

---

## Changes

### 1. Foreground Service Survives Task Kill

Change `stopWithTask` from `true` to `false` in AndroidManifest.xml.

**File:** `mobile/android/app/src/main/AndroidManifest.xml`

```xml
android:stopWithTask="false"
```

**What this does:** The foreground service continues running even if Android kills the app's task (e.g., under memory pressure or user swipes away from recents). The persistent notification ("Recording signal strength in background") keeps the service alive.

**Why this is safe:** This is the standard setting for foreground services that need to survive independently (navigation apps, music players, fitness trackers). The service already has `foregroundServiceType="location"` which makes it a high-priority foreground service that Android should avoid killing.

### 2. Memory Cap on signalCache (500 logs)

Add a cap to the in-memory signal cache in log-store.ts. Keep only the latest 500 logs in memory. Older logs remain in AsyncStorage and are accessible via `loadSignals()` when needed.

**File:** `mobile/src/features/offline-sync/services/log-store.ts`

**Behavior:**
- After adding a new signal log, check if `signalCache` exceeds 500 entries
- If so, trim to the latest 500 (by timestamp)
- The full dataset stays in AsyncStorage — only the in-memory cache is capped
- `loadSignals()` still reads from AsyncStorage (full data) on cold start
- This prevents memory growth during long sessions (30s interval × 500 = ~4 hours of data in memory)

**Why 500:** At 30-second intervals, 500 logs covers ~4 hours of continuous mapping. This is enough for all real-time features (map dots, consolidation, session stats) while keeping memory bounded at ~200KB.

### 3. Memory Cap on logsRef (100 logs)

Cap the session log buffer in use-session.ts at 100 entries. Logs are already saved individually to AsyncStorage on each capture, so `logsRef` is only used for live stats calculation (avgDbm, distance, etc.).

**File:** `mobile/src/features/sessions/hooks/use-session.ts`

**Behavior:**
- In `addLog()`, after pushing the new log, check if `logsRef.current.length > 100`
- If so, remove the oldest entries: `logsRef.current = logsRef.current.slice(-100)`
- `saveSessionSnapshot()` calculates stats from the last 100 logs (close enough for live display)
- On session complete, `completeSession()` should recalculate final stats from all logs in AsyncStorage (accurate)

**Why 100:** 100 logs × ~400 bytes = ~40KB. Trivial memory footprint. Stats calculated from the last 100 readings (50 minutes at 30s intervals) are close enough for the live display. Final stats on completion use the full dataset from AsyncStorage.

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/android/app/src/main/AndroidManifest.xml` | `stopWithTask="false"` |
| `mobile/src/features/offline-sync/services/log-store.ts` | Cap `signalCache` at 500 after each add |
| `mobile/src/features/sessions/hooks/use-session.ts` | Cap `logsRef` at 100 in `addLog()`, recalculate from AsyncStorage on complete |

Mirror `mobile/src/` changes to `src/` per architecture rule.

---

## Edge Cases

| Case | Handling |
|------|----------|
| Session > 4 hours | signalCache rotates; older logs still in AsyncStorage |
| completeSession with capped logsRef | Recalculate from AsyncStorage logs (full accuracy) |
| App killed with stopWithTask=false | Service continues logging; session recovery on restart |
| User swipes app away | Service stays alive; notification persists |
| Very long session (24h+) | signalCache stays at 500; AsyncStorage holds all; cleanup runs on next app mount |

---

## What's NOT in Scope

- Changing the logging interval (30s is fine)
- Battery optimization / adaptive intervals
- Location accuracy improvements (separate spec)
- Sync reliability improvements
