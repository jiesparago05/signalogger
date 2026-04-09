# Phase 1: Real Connectivity Capture + Classification

> **Status:** Ready to implement. Reviewed by ChatGPT 2026-04-10. Split from original combined plan per reviewer's recommendation to ship before data-hungry time-of-day layer (Phase 2).

**Goal:** Stop treating dBm as the sole signal-quality metric. Capture Android's own connectivity state (`NET_CAPABILITY_VALIDATED`, `LinkDownstreamBandwidthKbps`, `TelephonyManager.getDataState()`) on every reading, classify each reading into a simple 4-state scheme (OK / WEAK / NO INTERNET / NO SIGNAL), and surface sample count ("confidence") and data freshness in the UI so crowd-sourced readings can be trusted appropriately.

**Why ship this alone (not with time-of-day):**
- Immediate value with small data — works even with 4 test devices today.
- Rebuts the reddit critique ("signal ≠ experience") with concrete data, not just positioning.
- Stable foundation for Phase 2 (time-of-day) to build on once data volume grows.

**Architecture:** Five sequential steps. Native capture (Step 1) is the highest-risk change and must be verified before anything else proceeds. Steps 2–3 are pure logic / schema. Steps 4–5 are client UI. One feature branch, sequential commits, one final APK.

**Tech Stack:** Android Java (ConnectivityManager, NetworkCapabilities, TelephonyManager), React Native TypeScript, Express/Mongoose, Leaflet via WebView.

---

## Simplified State Model (ChatGPT feedback)

Original plan had 5 states (`ok` strong, `ok` weak-but-validated, `slow`, `data_dead`, `signal_dead`). Simplified to 4:

| State | Meaning | Condition | Dot color |
|-------|---------|-----------|-----------|
| `OK` | Strong signal + confirmed internet | `dbm > -95` AND `validated === true` | green |
| `WEAK` | Degraded but working (or unverified) | anything between | orange |
| `NO_INTERNET` | Signal present, internet confirmed broken | `validated === false` (explicit, not undefined) | red with orange ring |
| `NO_SIGNAL` | No usable signal at all | `dbm <= -115` OR `dbm === -999` | solid red |

Notes:
- `WEAK` is the catch-all for "working but not great." Collapses old `slow` and `weak-but-validated` into one state to reduce UI noise.
- `validated === undefined` means Android hasn't probed or it's legacy data — treated as ambiguous, falls into `WEAK` if dBm is low, `OK` if dBm is strong.
- Dead-zone alert fires on `NO_SIGNAL` OR `NO_INTERNET`, not on `WEAK`.

## Semantics of `validated` (important caveat)

`NET_CAPABILITY_VALIDATED` is **probabilistic, not real-time ground truth.** Android probes connectivity periodically, not continuously. A phone can lose internet and still report `validated=true` for many seconds. Same reverse: `validated=false` may lag behind a restored connection.

Rules to respect:
- Never fire an alert on a single `validated=false` reading. Require **3+ consecutive** readings agreeing, same discipline as the existing dead-zone consecutive-readings check (per `native-signal-validation.md`).
- Classification is per-reading for display purposes, but alerting is debounced.
- When in doubt, prefer `WEAK` over `NO_INTERNET`. False dead-zone alerts erode trust worse than a missed one.

## `downKbps` is captured but NOT used for classification (for now)

Capture `LinkDownstreamBandwidthKbps` into the log for future use, but do **not** let it drive the `classify()` function. Modem bandwidth estimates are too noisy on LTE and garbage on low-end devices. It's a weak hint worth storing, not a decision input.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `mobile/android/app/src/main/java/.../SignalModule.java` | Native capture of `validated`, `downKbps`, `upKbps`, `dataState` |
| `mobile/src/types/signal.ts` | Extend `SignalData` with new optional fields |
| `mobile/src/features/signal-logging/services/signal-reader.ts` | Pass new fields through from native bridge |
| `mobile/src/features/dead-zone/hooks/use-dead-zone.ts` | 4-state `classifyZone()` + alert differentiation |
| `mobile/src/lib/config/index.ts` | New thresholds |
| `server/models/signal-log.js` | Additive schema fields (no migration) |
| `mobile/src/features/map-view/components/MapScreen.tsx` | New dot colors + sample count + freshness in tooltips |
| `mobile/src/features/signal-logging/components/SignalSummary.tsx` (or equivalent) | Show freshness + confidence |

Mirror all `mobile/src/**` files to root `src/**` per architecture rule.

---

## Step 1 — Native Connectivity Capture

**Goal:** SignalModule returns `validated`, `downKbps`, `upKbps`, `dataState` alongside existing fields. All existing code keeps working unchanged.

**Files:**
- Modify: `mobile/android/app/src/main/java/.../SignalModule.java`
- Modify: `mobile/src/types/signal.ts`
- Modify: `mobile/src/features/signal-logging/services/signal-reader.ts`

- [ ] **Step 1.1: Read current SignalModule.java** — understand the existing `getSignalInfo()` return shape before editing.

- [ ] **Step 1.2: Add ConnectivityManager capture**

```java
// --- Connectivity capture ---
ConnectivityManager cm = (ConnectivityManager) getReactApplicationContext()
    .getSystemService(Context.CONNECTIVITY_SERVICE);

boolean validated = false;
int downKbps = 0;
int upKbps = 0;

if (cm != null) {
    Network active = cm.getActiveNetwork();
    if (active != null) {
        NetworkCapabilities caps = cm.getNetworkCapabilities(active);
        if (caps != null) {
            validated = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
            downKbps = caps.getLinkDownstreamBandwidthKbps();
            upKbps = caps.getLinkUpstreamBandwidthKbps();
        }
    }
}
```

Required imports:
```java
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
```

Permission `ACCESS_NETWORK_STATE` is standard in every RN template — verify it's present in `AndroidManifest.xml` but do not assume it's missing.

- [ ] **Step 1.3: Add TelephonyManager.getDataState capture**

```java
TelephonyManager tm = (TelephonyManager) getReactApplicationContext()
    .getSystemService(Context.TELEPHONY_SERVICE);
String dataState = "unknown";
if (tm != null) {
    switch (tm.getDataState()) {
        case TelephonyManager.DATA_CONNECTED:    dataState = "connected"; break;
        case TelephonyManager.DATA_SUSPENDED:    dataState = "suspended"; break;
        case TelephonyManager.DATA_DISCONNECTED: dataState = "disconnected"; break;
        case TelephonyManager.DATA_CONNECTING:   dataState = "connecting"; break;
        default:                                  dataState = "unknown"; break;
    }
}
```

- [ ] **Step 1.4: Add fields to the WritableMap response**

```java
map.putBoolean("validated", validated);
map.putInt("downKbps", downKbps);
map.putInt("upKbps", upKbps);
map.putString("dataState", dataState);
```

- [ ] **Step 1.5: Extend TypeScript types**

In `mobile/src/types/signal.ts`:

```typescript
export interface SignalData {
  dbm: number;
  validated?: boolean;
  downKbps?: number;
  upKbps?: number;
  dataState?: 'connected' | 'suspended' | 'disconnected' | 'connecting' | 'unknown';
}
```

All new fields are optional — old data and old server records don't have them.

- [ ] **Step 1.6: Pass through in `signal-reader.ts`**

```typescript
const raw = await SignalModule.getSignalInfo();
return {
  carrier: normalizeCarrier(raw.carrier || 'Unknown'),
  networkType: normalizeNetworkType(raw.networkType),
  signal: {
    dbm: raw.dbm ?? -999,
    validated: raw.validated,
    downKbps: raw.downKbps,
    upKbps: raw.upKbps,
    dataState: raw.dataState,
  },
  connection: {
    isWifi: raw.isWifi ?? false,
  },
};
```

- [ ] **Step 1.7: Build + install APK**

```bash
cp mobile/src/types/signal.ts /c/sl/mobile/src/types/signal.ts
cp mobile/src/features/signal-logging/services/signal-reader.ts /c/sl/mobile/src/features/signal-logging/services/signal-reader.ts
cp mobile/android/app/src/main/java/.../SignalModule.java /c/sl/mobile/android/app/src/main/java/.../SignalModule.java

cd /c/sl/mobile/android && ./gradlew.bat app:assembleRelease
adb install -r /c/sl/mobile/android/app/build/outputs/apk/release/app-release.apk
```

- [ ] **Step 1.8: Verify on device**

```bash
adb logcat | grep -i "signalog\|SIGNAL"
```

Expected: `validated: true` when connected to working WiFi or cellular, `dataState: "connected"` while using mobile data, `downKbps` > 0 on LTE.

**Acceptance criteria:**
- APK builds without errors
- App launches, signal readings appear
- New fields populate in the log (visible in logcat or AsyncStorage inspection)
- No regressions: session recording, dead zone detection, sync all still work
- Map test: re-map a previously known route and confirm it behaves identically to before (minus the new fields being present in the data)

**If this step fails:** STOP. Native crashes are hard to debug. Do not attempt Step 2.

---

## Step 2 — 4-State Classification + Alert Differentiation

**Goal:** Replace single `dbm < -115` test with the 4-state classifier. Dead-zone alert distinguishes `NO_SIGNAL` vs `NO_INTERNET`.

**Files:**
- Modify: `mobile/src/features/dead-zone/hooks/use-dead-zone.ts`
- Modify: `mobile/src/lib/config/index.ts`

- [ ] **Step 2.1: Add thresholds to config**

```typescript
export const DEAD_ZONE_DBM_THRESHOLD = -115;   // existing
export const STRONG_DBM_THRESHOLD = -95;       // new
export const DEAD_ZONE_CONSECUTIVE_READINGS = 3; // already exists
```

Note: deliberately NO `SLOW_KBPS_THRESHOLD`. `downKbps` is not used for classification (per ChatGPT feedback).

- [ ] **Step 2.2: Add `classifyZone()` function**

```typescript
export type ZoneState = 'OK' | 'WEAK' | 'NO_INTERNET' | 'NO_SIGNAL';

export function classifyZone(log: SignalLog): ZoneState {
  const dbm = log.signal.dbm;

  // No usable signal at all
  if (dbm === -999 || dbm <= DEAD_ZONE_DBM_THRESHOLD) return 'NO_SIGNAL';

  // Internet confirmed broken (explicit false, not undefined)
  if (log.signal.validated === false) return 'NO_INTERNET';

  // Strong + confirmed working
  if (dbm > STRONG_DBM_THRESHOLD && log.signal.validated === true) return 'OK';

  // Everything else is "working but degraded" or ambiguous
  return 'WEAK';
}
```

- [ ] **Step 2.3: Wire to dead zone alert logic**

Alert fires on `NO_SIGNAL` or `NO_INTERNET`. Require 3+ consecutive readings agreeing (existing consecutive-readings safeguard still applies). Respect existing cooldown (5 min per `native-signal-validation.md`).

Alert banner text:
- `NO_SIGNAL` → *"Signal dead zone"*
- `NO_INTERNET` → *"Data suspended — check your plan or network"*

Keep the existing vibration pattern for both.

- [ ] **Step 2.4: Export classifyZone for map use**

Other modules (map renderer, session display) should import and reuse `classifyZone()` — don't duplicate the logic.

- [ ] **Step 2.5: Smoke test**

Field test: re-map a previously known dead zone and a known-good area.
- Known dead zone: alert fires with "Signal dead zone" text
- Known-good area: no alerts
- WiFi-only area (airplane mode with WiFi on): should show `OK` if WiFi works, `NO_INTERNET` if it doesn't
- No regressions in sync, sessions, logging

---

## Step 3 — Server Schema Additions

**Goal:** Persist the new fields on `SignalLog`. Additive — no migration.

**Files:**
- Modify: `server/models/signal-log.js`

- [ ] **Step 3.1: Extend signal sub-schema**

```javascript
signal: {
  dbm: { type: Number, required: true },
  validated: Boolean,
  downKbps: Number,
  upKbps: Number,
  dataState: String,
}
```

- [ ] **Step 3.2: Deploy to Render**

Standard push-to-master. Watch Events tab for `Deploy succeeded`. No downtime expected; schema is additive.

- [ ] **Step 3.3: Verify post-deploy**

```bash
curl https://signalogger.onrender.com/api/health
```

Once new APK ships and a device logs at least one reading:

```javascript
// mongo shell
db.signallogs.findOne({ 'signal.validated': { $exists: true } })
```

---

## Step 4 — Client UI: Colors + Confidence + Freshness

**Goal:** Map dots use the 4-state colors. Tooltips and session details show sample count ("confidence") and last-updated time ("freshness").

**Files:**
- Modify: `mobile/src/features/map-view/components/MapScreen.tsx` (dot rendering, legend)
- Modify: `mobile/src/features/map-view/hooks/use-map-data.ts` (if classification happens client-side)
- Modify: `mobile/src/features/signal-logging/components/SignalSummary.tsx` (or wherever the selected reading detail is shown)
- Modify: legend component

- [ ] **Step 4.1: Update dot color logic**

Replace the current dBm gradient with a switch on `classifyZone(log)`:

```typescript
function dotColor(log: SignalLog): string {
  switch (classifyZone(log)) {
    case 'OK':          return '#22C55E'; // green
    case 'WEAK':        return '#F59E0B'; // orange
    case 'NO_INTERNET': return '#DC2626'; // red (with ring in SVG)
    case 'NO_SIGNAL':   return '#7F1D1D'; // dark red
  }
}
```

For `NO_INTERNET`, add a visual ring (orange outer + red inner) so it's distinguishable from `NO_SIGNAL` at a glance. Leaflet marker customization needed in the WebView injection.

- [ ] **Step 4.2: Update legend**

Replace the current dBm gradient legend with 4 states:

- 🟢 **OK** — signal strong and internet confirmed
- 🟠 **Weak** — working but degraded
- 🔴⭕ **No Internet** — signal present, data suspended or broken
- 🔴 **No Signal** — no usable signal

- [ ] **Step 4.3: Add sample count ("confidence") to dot tooltips**

Consolidated dots already carry `count` from the server. Surface it in the tooltip:

```
Smart 4G · -78 dBm
Based on 47 readings
Updated 12 minutes ago
```

For fresh (non-consolidated) dots, `count = 1` — show as "Single reading".

- [ ] **Step 4.4: Add freshness formatter**

Helper function to format relative time from a `timestamp` string:

```typescript
export function formatRelative(ts: string | Date): string {
  const now = Date.now();
  const then = new Date(ts).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}
```

Use it in:
- Dot tooltips
- Signal Summary bottom sheet
- Session Detail timestamp display (if not already)

- [ ] **Step 4.5: Update Signal Summary to show confidence + freshness**

When a user double-taps a consolidated dot to open the Signal Summary, show:
- Classification state (OK / Weak / No Internet / No Signal)
- Sample count ("Based on N readings")
- Last updated time ("Updated N min ago")
- Optional: min/avg/max dBm (existing)
- Optional: "% validated" ratio if `validated` data is available on the consolidated record

- [ ] **Step 4.6: Bottom sheet overlap check (per rule)**

Verify the Signal Summary bottom sheet still renders correctly:
- Collapsed state: no overlap with floating buttons
- Expanded state (55%): no overflow, all content scrollable
- Both on fresh dots (single reading) and consolidated dots (many readings)

Per `bottom-sheet-overlap-check.md`.

---

## Step 5 — Final Build + Field Test

- [ ] **Step 5.1: Mirror all mobile/src changes to root src/**

Per `edit-mobile-src-only.md`.

- [ ] **Step 5.2: Copy to short-path clone**

```bash
cp mobile/src/types/signal.ts /c/sl/mobile/src/types/signal.ts
cp mobile/src/features/signal-logging/services/signal-reader.ts /c/sl/mobile/src/features/signal-logging/services/signal-reader.ts
cp mobile/src/features/dead-zone/hooks/use-dead-zone.ts /c/sl/mobile/src/features/dead-zone/hooks/use-dead-zone.ts
cp mobile/src/lib/config/index.ts /c/sl/mobile/src/lib/config/index.ts
cp mobile/src/features/map-view/components/MapScreen.tsx /c/sl/mobile/src/features/map-view/components/MapScreen.tsx
# ... any others touched
```

- [ ] **Step 5.3: Build release**

```bash
cd /c/sl/mobile/android && ./gradlew.bat app:assembleRelease
```

- [ ] **Step 5.4: Install + install on all test devices**

```bash
for d in $(adb devices | grep -w "device" | awk '{print $1}'); do
  adb -s "$d" install -r /c/sl/mobile/android/app/build/outputs/apk/release/app-release.apk
done
```

- [ ] **Step 5.5: Field test on a commute**

Verify on a real commute:
- Dots render in the new colors
- Some areas show `NO_INTERNET` (orange ring) distinct from `NO_SIGNAL` (solid red)
- Tooltips show sample count and freshness
- Dead zone banner fires with the correct text per cause
- No crashes, no regressions

---

## Risk Matrix

| Step | Risk | Mitigation |
|------|------|-----------|
| 1 — Native capture | HIGH | Null-guard every ConnectivityManager call. Test in isolation. Build + logcat verify before Step 2. |
| 2 — Classification | MEDIUM | 3+ consecutive readings before alerting. Field test on known areas before shipping. |
| 3 — Server schema | LOW | Additive only. Standard Render deploy. |
| 4 — UI | MEDIUM | Bottom sheet overlap check. Test on consolidated + fresh dots. Check all sheet states. |
| 5 — Field test | LOW | Done on a real commute before declaring done. |

---

## Acceptance Criteria

- [ ] SignalModule returns `validated`, `downKbps`, `upKbps`, `dataState` on every reading
- [ ] New fields flow client → local → server → MongoDB without data loss
- [ ] Old records without these fields continue rendering and syncing without errors
- [ ] `classifyZone()` correctly maps readings to OK / WEAK / NO_INTERNET / NO_SIGNAL
- [ ] Dead-zone alert differentiates `NO_SIGNAL` vs `NO_INTERNET` with distinct banner text
- [ ] Map dots use the new 4-color scheme with `NO_INTERNET` visually distinct (ring)
- [ ] Tooltips show sample count ("Based on N readings") and freshness ("Updated N ago")
- [ ] Signal Summary bottom sheet shows classification + confidence + freshness
- [ ] Bottom sheet renders correctly in collapsed and expanded states
- [ ] No regressions in sessions, sync, logging, manual reports, background service
- [ ] Release APK built from `C:\sl`, installed on all test devices, field-tested on a commute

---

## Out of Scope (Phase 2 and later)

- **Time-of-day layer** — see `2026-04-10-phase2-time-of-day-layer.md`. Deferred until data volume supports it (~20+ active devices logging overlapping routes).
- **Active HTTP HEAD probes** to ground-truth `validated`. Useful future addition; needs battery / data budget review.
- **Opportunistic throughput sampling** during existing fetches. Instrumentation layer not in scope.
- **`dataState === 'suspended'` as its own classification state.** For now it collapses into `NO_INTERNET`. Split later if field data shows suspended is worth distinguishing from "just broken."
- **Day-of-week patterns.** Phase 2+ concern.
- **Pre-aggregation of `validated` / `downKbps` into `consolidated-signal`.** Aggregate on the fly in Phase 2 aggregation endpoint; optimize later.
