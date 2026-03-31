# Phase 2c — Dead Zone Alerts

## Overview

Real-time dead zone detection that alerts users when they enter an area with no signal, and notifies them when signal recovers. All detection is local (no internet needed) — logged dead zone events sync to the server when connectivity returns.

**Target users:** Filipino commuters who need to know when they've lost signal so they can plan around it (save messages, switch to offline mode, etc.)

---

## Detection Logic

### Trigger: Dead Zone Entry

A dead zone alert fires when:
- **2 consecutive signal readings** are below -105 dBm (the "dead" threshold)
- This takes ~10 seconds at the default 5-second polling interval
- Prevents false alerts from brief signal dips

### Trigger: Signal Recovery

A recovery notification fires when:
- Signal rises **above -105 dBm** after being in a dead zone state
- Immediate — no consecutive readings needed (good news is welcome instantly)

### Cooldown

- After a dead zone alert, **no new dead zone alert for 5 minutes**
- Prevents spam when user is at the edge of a dead zone (signal bouncing in/out)
- Recovery notifications are not rate-limited

---

## Features

### 1. Local Push Notification — Dead Zone

When dead zone is detected:
- **Title:** "⚠️ Dead Zone Detected"
- **Body:** "No signal in your area. Data will sync when signal returns."
- Works even when app is in background (uses existing react-native-background-actions)
- No internet required — notification is local

### 2. Local Push Notification — Signal Recovered

When signal returns:
- **Title:** "✅ Signal Recovered"
- **Body:** "Back online — {carrier} · {networkType} · {dBm} dBm"
- Gives user confidence their queued data will sync

### 3. In-App Red Banner

When in a dead zone, a red banner appears at the top of the map:
- Full-width strip above the map (below filter chips)
- **Text:** "⚠️ Dead Zone — No Signal"
- **Subtitle:** "Data will sync when signal returns"
- Dismisses automatically when signal recovers

### 4. Signal Display Dead Zone State

The bottom sheet signal display changes:
- dBm shows "--" instead of a number
- Level shows "☠️ Dead Zone" in red
- Carrier shows "{carrier} · No Signal"
- Status message: "Logging paused · Will resume when signal returns"

### 5. Auto-Log Dead Zone Events

Dead zone entry and exit are logged locally for later upload:
- Entry: timestamp, GPS coordinates (last known), carrier
- Exit: timestamp, GPS coordinates, duration in dead zone
- Synced to server when connectivity returns
- Stored in existing offline log queue

---

## Mobile App Changes

### New Files

| File | Purpose |
|------|---------|
| `src/features/dead-zone/hooks/use-dead-zone.ts` | Dead zone detection hook — monitors signal, manages state, triggers alerts |
| `src/features/dead-zone/services/dead-zone-notifier.ts` | Local push notifications for dead zone entry/recovery |
| `src/features/dead-zone/components/DeadZoneBanner.tsx` | Red banner overlay on map |

### Modified Files

| File | Change |
|------|--------|
| `src/features/signal-logging/components/SignalDisplay.tsx` | Dead zone state rendering (already partially handles -999) |
| `src/features/map-view/components/MapScreen.tsx` | Integrate DeadZoneBanner + useDeadZone hook |

---

## Data Flow

```
Signal Reading Loop (every 5s):
  readSignal() → dbm value
    → useDeadZone hook receives dbm
    → If dbm < -105: increment consecutiveDeadCount
    → If consecutiveDeadCount >= 2 AND not in cooldown:
        → Set inDeadZone = true
        → Fire local notification "Dead Zone Detected"
        → Log dead zone entry (timestamp, coords, carrier)
        → Start 5-min cooldown timer
    → If dbm >= -105 AND inDeadZone:
        → Set inDeadZone = false
        → Fire local notification "Signal Recovered"
        → Log dead zone exit (timestamp, coords, duration)
        → Reset consecutiveDeadCount

MapScreen:
  useDeadZone() → { inDeadZone, deadZoneStart }
    → If inDeadZone: show DeadZoneBanner
    → SignalDisplay receives inDeadZone prop for dead state rendering
```

---

## What's NOT in Scope

- Predictive alerts ("you're about to enter a dead zone") — needs geofencing, future phase
- Dead zone map overlay/layer — separate feature
- Dead zone community reporting — separate feature
- Dead zone history/analytics dashboard
- Server-side dead zone aggregation

---

## Testing Strategy

| What | How |
|------|-----|
| Dead zone detection | Simulate by turning on airplane mode or going to known dead spot |
| 2-reading threshold | Verify alert doesn't fire on single dead reading |
| 5-min cooldown | Enter dead zone, exit, re-enter within 5 min — should not re-alert |
| Recovery notification | Exit dead zone — verify recovery notification fires |
| In-app banner | Verify red banner appears/disappears with dead zone state |
| Signal display | Verify "--" and "Dead Zone" state in bottom sheet |
| Background notification | Put app in background, enter dead zone — notification should appear |
| Offline logging | Verify dead zone events are logged locally and sync later |
