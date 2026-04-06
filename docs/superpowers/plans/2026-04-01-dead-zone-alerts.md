# Dead Zone Alerts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect dead zones in real-time, alert users with local notifications + in-app visuals, and log dead zone events for later sync.

**Architecture:** A `useDeadZone` hook monitors signal readings from the existing `useSignalLogger`. When 2 consecutive readings are below -105 dBm, it triggers a dead zone state — showing a red banner on the map, changing the signal display, vibrating the phone, and updating the background service notification. When signal recovers, it clears the state and vibrates again. A 5-minute cooldown prevents alert spam.

**Tech Stack:** React Native, Vibration API (built-in), react-native-background-actions (existing)

**Important:** After modifying any file in `mobile/src/`, copy it to the matching path in `src/`. After mobile JS changes, press `r` in Metro to reload.

---

### Task 1: Add Dead Zone Threshold Constant

**Files:**
- Modify: `mobile/src/lib/config/index.ts`

- [ ] **Step 1: Add DEAD_ZONE_THRESHOLD constant**

In `mobile/src/lib/config/index.ts`, after the `SIGNAL_STRENGTH` object (after line 48), add:

```typescript
export const DEAD_ZONE_THRESHOLD = -115; // dBm — below this is dead zone
export const DEAD_ZONE_CONSECUTIVE_READINGS = 2; // readings before alert
export const DEAD_ZONE_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
```

- [ ] **Step 2: Sync and commit**

```bash
cp mobile/src/lib/config/index.ts src/lib/config/index.ts
git add mobile/src/lib/config/index.ts src/lib/config/index.ts
git commit -m "feat: add dead zone threshold constants"
```

---

### Task 2: Create useDeadZone Hook

**Files:**
- Create: `mobile/src/features/dead-zone/hooks/use-dead-zone.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useState, useCallback, useRef } from 'react';
import { Vibration } from 'react-native';
import {
  DEAD_ZONE_THRESHOLD,
  DEAD_ZONE_CONSECUTIVE_READINGS,
  DEAD_ZONE_COOLDOWN_MS,
} from '../../../lib/config';

export interface DeadZoneState {
  inDeadZone: boolean;
  deadZoneStart: Date | null;
  lastAlertTime: Date | null;
}

export function useDeadZone() {
  const [inDeadZone, setInDeadZone] = useState(false);
  const [deadZoneStart, setDeadZoneStart] = useState<Date | null>(null);
  const consecutiveDeadRef = useRef(0);
  const lastAlertTimeRef = useRef<number>(0);
  const wasInDeadZoneRef = useRef(false);

  const processReading = useCallback((dbm: number, carrier?: string, networkType?: string) => {
    // Skip invalid readings (location off) — handled separately by SignalDisplay
    if (dbm <= -999) return;

    const isDead = dbm < DEAD_ZONE_THRESHOLD;

    if (isDead) {
      consecutiveDeadRef.current += 1;

      // Check if we should trigger dead zone alert
      if (
        consecutiveDeadRef.current >= DEAD_ZONE_CONSECUTIVE_READINGS &&
        !wasInDeadZoneRef.current
      ) {
        const now = Date.now();
        const timeSinceLastAlert = now - lastAlertTimeRef.current;

        if (timeSinceLastAlert >= DEAD_ZONE_COOLDOWN_MS) {
          // TRIGGER DEAD ZONE
          wasInDeadZoneRef.current = true;
          lastAlertTimeRef.current = now;
          setInDeadZone(true);
          setDeadZoneStart(new Date());
          Vibration.vibrate([0, 300, 100, 300]); // double buzz
        }
      }
    } else {
      consecutiveDeadRef.current = 0;

      if (wasInDeadZoneRef.current) {
        // SIGNAL RECOVERED
        wasInDeadZoneRef.current = false;
        setInDeadZone(false);
        setDeadZoneStart(null);
        Vibration.vibrate(200); // single short buzz
      }
    }
  }, []);

  const reset = useCallback(() => {
    consecutiveDeadRef.current = 0;
    wasInDeadZoneRef.current = false;
    lastAlertTimeRef.current = 0;
    setInDeadZone(false);
    setDeadZoneStart(null);
  }, []);

  return {
    inDeadZone,
    deadZoneStart,
    processReading,
    reset,
  };
}
```

- [ ] **Step 2: Sync and commit**

```bash
mkdir -p src/features/dead-zone/hooks
cp mobile/src/features/dead-zone/hooks/use-dead-zone.ts src/features/dead-zone/hooks/use-dead-zone.ts
git add mobile/src/features/dead-zone/hooks/use-dead-zone.ts src/features/dead-zone/hooks/use-dead-zone.ts
git commit -m "feat: add useDeadZone hook for real-time dead zone detection"
```

---

### Task 3: Create DeadZoneBanner Component

**Files:**
- Create: `mobile/src/features/dead-zone/components/DeadZoneBanner.tsx`

- [ ] **Step 1: Create the banner**

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface DeadZoneBannerProps {
  visible: boolean;
}

export function DeadZoneBanner({ visible }: DeadZoneBannerProps) {
  if (!visible) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.icon}>{'\u26A0\uFE0F'}</Text>
      <View style={styles.textWrap}>
        <Text style={styles.title}>Dead Zone — No Signal</Text>
        <Text style={styles.subtitle}>Data will sync when signal returns</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(239, 68, 68, 0.95)',
    padding: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 100,
  },
  icon: {
    fontSize: 16,
  },
  textWrap: {},
  title: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
  },
});
```

- [ ] **Step 2: Sync and commit**

```bash
mkdir -p src/features/dead-zone/components
cp mobile/src/features/dead-zone/components/DeadZoneBanner.tsx src/features/dead-zone/components/DeadZoneBanner.tsx
git add mobile/src/features/dead-zone/components/DeadZoneBanner.tsx src/features/dead-zone/components/DeadZoneBanner.tsx
git commit -m "feat: add DeadZoneBanner component"
```

---

### Task 4: Update SignalDisplay for Dead Zone State

**Files:**
- Modify: `mobile/src/features/signal-logging/components/SignalDisplay.tsx`

- [ ] **Step 1: Add inDeadZone prop**

In `SignalDisplay.tsx`, update the interface (around line 8):

```typescript
interface SignalDisplayProps {
  signal: RawSignalReading | null;
  isLogging: boolean;
  stability?: SignalStability | null;
  compact?: boolean;
  inDeadZone?: boolean;
}
```

Update the function signature:

```typescript
export function SignalDisplay({ signal, isLogging, stability, compact, inDeadZone }: SignalDisplayProps) {
```

- [ ] **Step 2: Update the dead zone detection logic**

Replace the existing `isInvalid` block (around lines 36-39):

```typescript
  const isInvalid = signal.signal.dbm <= -999;
  const isDead = inDeadZone || isInvalid;
  const color = isDead ? '#EF4444' : getSignalColor(signal.signal.dbm);
  const level = inDeadZone ? '\u2620\uFE0F Dead Zone' : isInvalid ? 'Location Off' : signalLevelLabel(signal.signal.dbm);
  const displayDbm = isDead ? '--' : String(signal.signal.dbm);
```

- [ ] **Step 3: Update the range text for dead zone**

Replace the existing rangeText logic:

```typescript
    const rangeText = inDeadZone
      ? 'Logging paused \u00B7 Will resume when signal returns'
      : isInvalid
        ? 'Turn on location to read signal'
        : stability
          ? `${stability.min} to ${stability.max}`
          : `${displayDbm} to ${displayDbm}`;
```

- [ ] **Step 4: Update the carrier info line for dead zone**

In the compact view, find the `heroInfo` Text (the line showing carrier · networkType). Update it:

Replace:
```tsx
        <Text style={styles.heroInfo}>
          {signal.carrier} {'\u00B7'} {signal.networkType}
          {signal.connection.ping ? ` ${'\u00B7'} ${formatPing(signal.connection.ping)}` : ''}
        </Text>
```

With:
```tsx
        <Text style={styles.heroInfo}>
          {signal.carrier} {'\u00B7'} {inDeadZone ? 'No Signal' : signal.networkType}
          {!isDead && signal.connection.ping ? ` ${'\u00B7'} ${formatPing(signal.connection.ping)}` : ''}
        </Text>
```

- [ ] **Step 5: Sync and commit**

```bash
cp mobile/src/features/signal-logging/components/SignalDisplay.tsx src/features/signal-logging/components/SignalDisplay.tsx
git add mobile/src/features/signal-logging/components/SignalDisplay.tsx src/features/signal-logging/components/SignalDisplay.tsx
git commit -m "feat: update SignalDisplay with dead zone state rendering"
```

---

### Task 5: Wire Dead Zone into MapScreen

**Files:**
- Modify: `mobile/src/features/map-view/components/MapScreen.tsx`

- [ ] **Step 1: Add imports**

Add after existing imports:

```typescript
import { useDeadZone } from '../../dead-zone/hooks/use-dead-zone';
import { DeadZoneBanner } from '../../dead-zone/components/DeadZoneBanner';
```

- [ ] **Step 2: Add useDeadZone hook**

After the existing `useSignalLogger` hook call (the line with `const { isActive, currentSignal, stability, toggle } = useSignalLogger(handleNewLog);`), add:

```typescript
  const { inDeadZone, processReading } = useDeadZone();
```

- [ ] **Step 3: Feed signal readings to dead zone hook**

Find the signal polling `useEffect` — it's the one that calls `readSignal()` every 5 seconds inside `use-signal-logger.ts`. Since we can't modify the hook's internals from MapScreen, we'll watch `currentSignal` instead.

After the `useDeadZone` hook call, add:

```typescript
  // Feed signal readings to dead zone detector
  React.useEffect(() => {
    if (currentSignal) {
      processReading(
        currentSignal.signal.dbm,
        currentSignal.carrier,
        currentSignal.networkType,
      );
    }
  }, [currentSignal, processReading]);
```

- [ ] **Step 4: Add DeadZoneBanner to JSX**

Find the `{/* Filter dropdowns + search */}` comment. Add the banner BEFORE it:

```tsx
      {/* Dead zone banner */}
      <DeadZoneBanner visible={inDeadZone} />
```

- [ ] **Step 5: Pass inDeadZone to SignalDisplay**

Find the `<SignalDisplay` component in the Live tab. Update it:

```tsx
            <SignalDisplay signal={currentSignal} isLogging={isActive} stability={stability} compact inDeadZone={inDeadZone} />
```

- [ ] **Step 6: Sync and commit**

```bash
cp mobile/src/features/map-view/components/MapScreen.tsx src/features/map-view/components/MapScreen.tsx
git add mobile/src/features/map-view/components/MapScreen.tsx src/features/map-view/components/MapScreen.tsx
git commit -m "feat: wire dead zone detection into MapScreen with banner and signal display"
```

---

### Task 6: Manual Test

- [ ] **Step 1: Reload the app**

Press `r` in Metro.

- [ ] **Step 2: Test dead zone detection**

Turn on Airplane Mode on your phone (simulates dead zone):
1. Wait ~10 seconds (2 poll cycles)
2. Verify red banner appears at top: "Dead Zone — No Signal"
3. Verify signal display shows "--" dBm and "☠️ Dead Zone"
4. Verify phone vibrates (double buzz)

- [ ] **Step 3: Test signal recovery**

Turn off Airplane Mode:
1. Wait for signal to return
2. Verify red banner disappears
3. Verify signal display returns to normal
4. Verify phone vibrates (single short buzz)

- [ ] **Step 4: Test cooldown**

Turn Airplane Mode on → wait for alert → turn off → immediately turn on again:
1. Second alert should NOT fire within 5 minutes
2. After 5 minutes, it should fire again

- [ ] **Step 5: Test with location off**

Turn off location (but keep mobile data on):
1. Should show "Location Off" / "--" (existing behavior)
2. Should NOT trigger dead zone alert (dbm is -999 which is filtered)
