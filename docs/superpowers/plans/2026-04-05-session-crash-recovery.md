# Session Crash Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent session data loss when Android kills the app mid-recording by adding periodic auto-save, AppState background save, and always-recover on restart.

**Architecture:** All changes are in `use-session.ts`. Add a 60-second auto-save interval that persists session stats to AsyncStorage during recording, an AppState listener for last-chance save on background, and modify the startup restore logic to always recover crashed sessions by recalculating stats from the saved signal logs.

**Tech Stack:** React Native, AsyncStorage, AppState API

---

## File Structure

| File | Responsibility |
|------|---------------|
| `mobile/src/features/sessions/hooks/use-session.ts` | All crash recovery logic: auto-save interval, AppState listener, recovery on restart |

Mirror to `src/features/sessions/hooks/use-session.ts` per architecture rule.

---

### Task 1: Add `computeSessionStats` helper function

Extract the stats calculation logic (already duplicated in `completeSession` and `autoCompleteSession`) into a shared helper. This will be reused by auto-save, background save, and recovery.

**Files:**
- Modify: `mobile/src/features/sessions/hooks/use-session.ts`

- [ ] **Step 1: Add the helper function**

Add this function after `updateLocalSession` and before `export function useSession()` (around line 35):

```typescript
function computeSessionStats(logs: SignalLog[]): {
  logCount: number;
  avgDbm: number;
  minDbm: number;
  maxDbm: number;
  distanceMeters: number;
  stability: 'Stable' | 'Fluctuating' | 'Unstable';
  endTime: Date;
  endLocation?: { type: 'Point'; coordinates: [number, number] };
} {
  const validLogs = logs
    .filter((l) => l.timestamp && l.location?.coordinates?.length === 2)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const dbms = validLogs.map((l) => l.signal.dbm).filter((d) => d > -999);
  const avgDbm = dbms.length > 0 ? Math.round(dbms.reduce((s, v) => s + v, 0) / dbms.length) : 0;
  const minDbm = dbms.length > 0 ? Math.min(...dbms) : 0;
  const maxDbm = dbms.length > 0 ? Math.max(...dbms) : 0;
  const range = maxDbm - minDbm;

  let totalDistance = 0;
  for (let i = 1; i < validLogs.length; i++) {
    const prev = validLogs[i - 1].location.coordinates;
    const curr = validLogs[i].location.coordinates;
    const R = 6371000;
    const dLat = ((curr[1] - prev[1]) * Math.PI) / 180;
    const dLng = ((curr[0] - prev[0]) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((prev[1] * Math.PI) / 180) *
        Math.cos((curr[1] * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    totalDistance += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const lastLog = validLogs[validLogs.length - 1];

  return {
    logCount: validLogs.length,
    avgDbm,
    minDbm,
    maxDbm,
    distanceMeters: Math.round(totalDistance),
    stability: range <= 10 ? 'Stable' : range <= 25 ? 'Fluctuating' : 'Unstable',
    endTime: lastLog ? new Date(lastLog.timestamp) : new Date(),
    endLocation: lastLog ? { type: 'Point', coordinates: lastLog.location.coordinates } : undefined,
  };
}
```

- [ ] **Step 2: Refactor `completeSession` to use the helper**

In `completeSession` (around line 113), replace the manual stats calculation with:

```typescript
  const completeSession = useCallback(async () => {
    if (!activeSession) return null;

    const logs = logsRef.current;
    const stats = computeSessionStats(logs);

    let endLocation = stats.endLocation;
    try {
      const loc = await getCurrentLocation();
      endLocation = { type: 'Point' as const, coordinates: loc.coordinates };
    } catch {}

    const finalStats: Partial<MappingSession> = {
      ...stats,
      endTime: new Date(),
      endLocation,
      status: 'completed',
    };

    const completed = { ...activeSession, ...finalStats };

    await updateLocalSession(activeSession._id, finalStats);

    if (activeSession._id && !activeSession._id.startsWith('local_')) {
      api.sessions.complete(activeSession._id, finalStats).catch(() => {});
    }

    setActiveSession(null);
    logsRef.current = [];
    return completed;
  }, [activeSession]);
```

- [ ] **Step 3: Refactor `autoCompleteSession` to use the helper**

Replace the entire `autoCompleteSession` function (bottom of file) with:

```typescript
async function autoCompleteSession(session: MappingSession): Promise<void> {
  try {
    let logs: SignalLog[] = [];

    if (session._id) {
      logs = await getLogsBySessionId(session._id);
    }
    if (logs.length === 0 && session.startTime) {
      logs = await getLogsByTimeRange(new Date(session.startTime), new Date());
    }

    // Filter corrupt logs
    const validLogs = logs.filter(
      (l) => l.timestamp && l.location?.coordinates?.length === 2 && l.signal.dbm > -999
    );

    if (validLogs.length === 0) {
      // Nothing to recover — discard
      return;
    }

    const stats = computeSessionStats(validLogs);

    await updateLocalSession(session._id, {
      ...stats,
      status: 'recovered',
    });
  } catch {}
}
```

- [ ] **Step 4: Commit**

```bash
git add mobile/src/features/sessions/hooks/use-session.ts
git commit -m "refactor: extract computeSessionStats helper for reuse"
```

---

### Task 2: Always recover crashed sessions on restart

Modify the startup restore logic to always auto-complete crashed sessions instead of only those >2 hours old.

**Files:**
- Modify: `mobile/src/features/sessions/hooks/use-session.ts`

- [ ] **Step 1: Update the restore useEffect**

Replace the restore `useEffect` (lines 41-60) with:

```typescript
  // Recover crashed session on app restart
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
        if (!raw) return;

        // Clear immediately to prevent duplicate recovery on quick restart
        await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);

        const saved = JSON.parse(raw) as MappingSession;

        // Always recover — the background service is dead, session can't resume
        await autoCompleteSession(saved);
      } catch {}
    })();
  }, []);
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/features/sessions/hooks/use-session.ts
git commit -m "fix: always recover crashed sessions on restart (remove 2h threshold)"
```

---

### Task 3: Add periodic auto-save interval (60 seconds) + first-log save

Add a 60-second interval that persists current session stats to AsyncStorage during recording, and an immediate save on the first log captured.

**Files:**
- Modify: `mobile/src/features/sessions/hooks/use-session.ts`

- [ ] **Step 1: Add a helper function to save current stats**

Add this inside the `useSession` hook, after the `logsRef` declaration:

```typescript
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const saveSessionSnapshot = useCallback(() => {
    if (!activeSession || logsRef.current.length === 0) return;
    const stats = computeSessionStats(logsRef.current);
    const updated = { ...activeSession, ...stats, lastUpdated: new Date().toISOString() };
    AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(updated)).catch(() => {});
  }, [activeSession]);
```

- [ ] **Step 2: Add the 60-second auto-save interval**

Add a new `useEffect` after the existing `activeSession` persist effect (after line 69):

```typescript
  // Auto-save session stats every 60 seconds
  useEffect(() => {
    if (activeSession) {
      autoSaveRef.current = setInterval(() => {
        saveSessionSnapshot();
      }, 60000);
    } else {
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current);
        autoSaveRef.current = null;
      }
    }
    return () => {
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current);
        autoSaveRef.current = null;
      }
    };
  }, [activeSession, saveSessionSnapshot]);
```

- [ ] **Step 3: Add first-log immediate save in `addLog`**

Update the `addLog` callback to trigger a save on the first log:

```typescript
  const addLog = useCallback((log: SignalLog) => {
    logsRef.current.push(log);
    // Save snapshot on first log (covers short sessions killed before 60s interval)
    if (logsRef.current.length === 1) {
      saveSessionSnapshot();
    }
  }, [saveSessionSnapshot]);
```

- [ ] **Step 4: Commit**

```bash
git add mobile/src/features/sessions/hooks/use-session.ts
git commit -m "feat: add 60s auto-save interval and first-log immediate save"
```

---

### Task 4: Add AppState background save

Add an AppState listener that saves session stats when the app goes to background.

**Files:**
- Modify: `mobile/src/features/sessions/hooks/use-session.ts`

- [ ] **Step 1: Add AppState import**

Update the react-native import at the top. Currently there's no react-native import in this file, so add:

```typescript
import { AppState } from 'react-native';
```

- [ ] **Step 2: Add the AppState listener**

Add a new `useEffect` after the auto-save interval effect:

```typescript
  // Save session on app background (last chance before potential OS kill)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        saveSessionSnapshot();
      }
    });
    return () => subscription.remove();
  }, [saveSessionSnapshot]);
```

- [ ] **Step 3: Commit**

```bash
git add mobile/src/features/sessions/hooks/use-session.ts
git commit -m "feat: add AppState background save for session crash recovery"
```

---

### Task 5: Mirror to src/ and final commit

**Files:**
- Mirror: `mobile/src/features/sessions/hooks/use-session.ts` → `src/features/sessions/hooks/use-session.ts`

- [ ] **Step 1: Copy to src/**

```bash
cp mobile/src/features/sessions/hooks/use-session.ts src/features/sessions/hooks/use-session.ts
```

- [ ] **Step 2: Commit**

```bash
git add src/features/sessions/hooks/use-session.ts
git commit -m "chore: sync mobile session hook changes to src/"
```

---

### Task 6: Manual Testing

- [ ] **Step 1: Test normal session flow**

1. Start a recording session
2. Wait 60+ seconds — verify no crashes
3. Stop the session normally
4. Check sessions list — session shows with correct stats
5. Verify this still works exactly as before

- [ ] **Step 2: Test crash recovery**

1. Start a recording session
2. Wait ~30 seconds (capture some logs)
3. Force-kill the app (swipe away or `adb shell am force-stop com.signalogger`)
4. Reopen the app
5. Check sessions list — recovered session should appear with correct stats
6. Verify the session shows log count > 0, distance > 0, reasonable avg dBm

- [ ] **Step 3: Test short session recovery**

1. Start a recording session
2. Wait ~5 seconds (just 1-2 logs)
3. Force-kill the app
4. Reopen — recovered session should still appear (first-log save covers this)

- [ ] **Step 4: Test duplicate recovery protection**

1. Start a recording session
2. Force-kill the app
3. Reopen the app (session recovers)
4. Force-kill again immediately
5. Reopen — should NOT have a duplicate recovered session

- [ ] **Step 5: Test AppState background save**

1. Start a recording session
2. Wait ~10 seconds
3. Press Home button (app goes to background)
4. Force-kill from recent apps
5. Reopen — session should be recovered with stats from the background save
