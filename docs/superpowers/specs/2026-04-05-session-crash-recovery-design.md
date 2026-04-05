# Session Crash Recovery

## Overview

Prevent session data loss when Android kills the app during recording. Currently, session stats are only saved when the user taps Stop → `completeSession()`. If the OS kills the app (memory pressure, user swipe-close), the session record is lost even though individual signal logs are already saved to AsyncStorage.

**Problem:** User records a 20-minute commute session. Android kills the app at minute 15. The 15 minutes of signal logs exist in AsyncStorage, but the session record has no final stats (end time, distance, avg dBm, log count). On restart, the session either shows stale stats or is lost entirely.

---

## Changes

### 1. Periodic Auto-Save (every 60 seconds)

While a session is actively recording, run a 60-second interval that updates the `activeSession` in AsyncStorage with current stats.

**Stats to save:**
- `logCount` — number of signal logs captured so far
- `avgDbm` — running average dBm from all logs in this session
- `distance` — cumulative distance traveled (meters)
- `lastLocation` — most recent coordinates
- `lastUpdated` — timestamp of this auto-save

**Implementation:**
- Start the interval when `activeSession` is set (session starts)
- Clear the interval when session completes or component unmounts
- Calculate stats from the logs accumulated in `logsRef`
- Write to AsyncStorage under `ACTIVE_SESSION_KEY` (already exists)

**First-log immediate save:** Also save a session snapshot immediately when the first signal log is captured. This covers short sessions (< 60 seconds) that get killed before the first interval fires.

**Why 60 seconds for interval:** Balances write frequency vs data freshness. Signal logs are already saved individually, so worst case we lose ~60 seconds of session-level stats, not the underlying data.

### 2. AppState Background Save

Add an `AppState` event listener that saves session stats when the app transitions to "background".

**Behavior:**
- Listen for `AppState.change` events
- When state changes to `'background'` and an active session exists:
  - Calculate current stats from `logsRef`
  - Save updated `activeSession` to AsyncStorage
- This is a last-chance save before potential OS kill

**Implementation:**
- Add the listener in `useSession` hook
- Clean up listener on unmount
- Import `AppState` from `react-native`

### 3. Crash Recovery on Restart

Modify `autoCompleteSession()` to always recover crashed sessions on restart, removing the 2-hour age threshold.

**Current behavior:**
- On app start, checks for `ACTIVE_SESSION_KEY` in AsyncStorage
- Only auto-completes if session is >2 hours old
- Otherwise restores as "active" (but the recording is dead since the background service is gone)

**New behavior:**
- On app start, if `ACTIVE_SESSION_KEY` exists in AsyncStorage:
  - Clear `ACTIVE_SESSION_KEY` immediately (prevents duplicate recovery if app restarts again quickly)
  - Fetch all signal logs for that session ID from AsyncStorage
  - Filter out corrupt logs (must have valid timestamp + coordinates)
  - If 0 valid logs → discard session, done
  - Recalculate final stats from the valid logs:
    - `logCount` — number of valid logs
    - `avgDbm` — average of all dBm values
    - `endTime` — timestamp of the last log
    - `distance` — sum of haversine distances between consecutive GPS points
  - Mark session as completed with `status: 'recovered'`
  - Save to the completed sessions list in AsyncStorage
  - Upload to server (if online)
  - No prompt — silent recovery

**Why no prompt:** The session is over — the background service is dead, the recording can't resume. Silently recovering and showing it in the sessions list is the cleanest UX.

**Why recalculate from logs:** The auto-saved stats might be up to 60 seconds stale. The actual signal logs are the source of truth, so we recalculate from them for accuracy.

**Distance recomputation:** Calculate using haversine formula between consecutive log GPS points, sorted by timestamp. This gives accurate route distance even though individual logs don't store cumulative distance.

---

## Data Flow

```
Normal session:
  Start → Record → [60s auto-save stats] → Stop → completeSession() → saved

App killed mid-session:
  Start → Record → [60s auto-save stats] → [AppState background save] → KILLED
  
  Next app start:
  → Found ACTIVE_SESSION_KEY → Fetch logs by sessionId
  → Recalculate stats from logs → Mark "recovered" → Save to sessions list → Clear active key
```

---

## Session Status Field

Add a `status` field to the session record to distinguish normal vs recovered sessions:

- `'completed'` — user tapped Stop (normal)
- `'recovered'` — auto-completed from crash recovery

The UI can optionally show a subtle indicator for recovered sessions (e.g., small "recovered" badge), but this is cosmetic and not required for v1.

---

## Edge Cases

| Case | Handling |
|------|----------|
| App killed with 0 logs captured | Discard the session (nothing to recover) |
| App killed during first 5 seconds | Still recover — even 1 log is worth saving |
| Multiple crashes in a row | Each restart checks and recovers, so no buildup |
| User manually force-stops app | Same as OS kill — recovered on next start |
| AsyncStorage write fails during auto-save | Silent catch — next interval or background save will retry |
| No internet on restart | Session saved locally, server upload happens via background sync |
| Duplicate recovery (quick restart) | `ACTIVE_SESSION_KEY` cleared first — second restart finds nothing to recover |
| Corrupt logs (missing timestamp/coords) | Filtered out during recovery — only valid logs used for stats |
| Short session (< 60s) killed before interval | First-log immediate save ensures session snapshot exists |

---

## Files to Modify

| File | Change |
|------|--------|
| `mobile/src/features/sessions/hooks/use-session.ts` | Add 60s auto-save interval, AppState listener, update `autoCompleteSession()` to always recover + recalculate from logs |

Mirror to `src/features/sessions/hooks/use-session.ts` per architecture rule.

---

## What's NOT in Scope

- Resume recording after crash (session is over once the app dies)
- Foreground service keep-alive / preventing OS kill (separate spec — memory optimization)
- GPS accuracy improvements (separate spec — location reliability)
- UI changes for recovered sessions (optional cosmetic, not blocking)
