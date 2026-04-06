# Session Detail Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign SessionDetail into a polished "Trip Summary" screen with signal readings list, removing wasted space.

**Architecture:** Single component rewrite. Data comes from existing `MappingSession` prop + `getLogsByTimeRange()` from log-store. Pagination via local state slicing. No new files.

**Tech Stack:** React Native (View, Text, ScrollView, StyleSheet)

**Important:** After modifying `mobile/src/features/sessions/components/SessionDetail.tsx`, copy it to `src/features/sessions/components/SessionDetail.tsx`. For release builds, also copy to `C:\sl\`.

---

### Task 1: Rewrite SessionDetail Component

**Files:**
- Modify: `mobile/src/features/sessions/components/SessionDetail.tsx`

- [ ] **Step 1: Add SignalLog import and state for readings + pagination**

At the top of the file, update imports and add state:

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { api } from '../../../lib/api/client';
import { getSignalColor } from '../../../lib/config';
import { getLogsByTimeRange } from '../../offline-sync/services/log-store';
import { MappingSession, SignalLog } from '../../../types/signal';
```

Inside the component, after the existing `loading` state, add:

```typescript
const [readings, setReadings] = useState<SignalLog[]>([]);
const [visibleCount, setVisibleCount] = useState(20);
```

- [ ] **Step 2: Load signal readings in the existing useEffect**

Replace the entire `useEffect` block (lines 19-56) with:

```typescript
useEffect(() => {
  if (!session._id) return;

  const toTrailPoints = (logs: any[]) =>
    logs
      .filter((l: any) => l.location?.coordinates)
      .map((l: any) => {
        const [lng, lat] = l.location.coordinates;
        return { lat, lng, color: '#3B82F6' };
      });

  (async () => {
    // Load local logs first (instant) — used for both trail AND readings
    if (session.startTime && session.endTime) {
      const localLogs = await getLogsByTimeRange(
        new Date(session.startTime),
        new Date(session.endTime),
      );
      if (localLogs.length > 0) {
        onDrawTrail(toTrailPoints(localLogs));
        setReadings(localLogs);
        setLoading(false);
      }
    }

    // Fetch server trail in background (may have more data)
    if (session._id && !session._id.startsWith('local_')) {
      api.sessions.getTrail(session._id).then((res) => {
        if (res.data && res.data.length > 0) {
          onDrawTrail(toTrailPoints(res.data));
          if (res.data.length > readings.length) {
            setReadings(res.data);
          }
        }
      }).catch(() => {});
    }

    setLoading(false);
  })();

  return () => onClearTrail();
}, [session._id]);
```

- [ ] **Step 3: Add helper for signal bar width**

After the `useEffect`, before the `return`, add:

```typescript
const getBarWidth = (dbm: number): number => {
  // 0 dBm = 100%, -130 dBm = 0%
  return Math.max(0, Math.min(100, ((dbm + 130) / 130) * 100));
};

const visibleReadings = readings.slice(0, visibleCount);
const hasMore = readings.length > visibleCount;
const remaining = readings.length - visibleCount;
```

- [ ] **Step 4: Rewrite the JSX return**

Replace the entire `return (...)` block (lines 67-118) with:

```tsx
return (
  <View style={styles.container}>
    <View style={styles.backBtn} onTouchEnd={onBack}>
      <Text style={styles.backText}>{'\u2190'} Sessions</Text>
    </View>

    <ScrollView style={styles.content}>
      {/* Trip Summary label */}
      <Text style={styles.sectionLabel}>Trip Summary</Text>

      {/* Title + avg dBm */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            {start.toLocaleDateString([], { month: 'short', day: 'numeric' })} {'\u00B7'} {durationMin} min {'\u00B7'} {distKm} km {'\u00B7'} {session.logCount} logs
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.headerDbm, { color: signalColor }]}>{session.avgDbm}</Text>
          <Text style={styles.headerDbmLabel}>avg dBm</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: getSignalColor(session.maxDbm) }]}>{session.maxDbm}</Text>
          <Text style={styles.statLabel}>Best</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: getSignalColor(session.avgDbm) }]}>{session.avgDbm}</Text>
          <Text style={styles.statLabel}>Avg</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: getSignalColor(session.minDbm) }]}>{session.minDbm}</Text>
          <Text style={styles.statLabel}>Worst</Text>
        </View>
      </View>

      {/* Chips */}
      <View style={styles.chipsRow}>
        <View style={styles.chip}>
          <Text style={styles.chipText}>{session.carrier}</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipText}>{session.networkType}</Text>
        </View>
        <View style={[styles.chip, styles.stabilityChip]}>
          <Text style={[styles.chipText, {
            color: session.stability === 'Stable' ? '#4ADE80' : session.stability === 'Fluctuating' ? '#EAB308' : '#EF4444',
          }]}>
            {session.stability === 'Fluctuating' ? '\u26A0 ' : ''}{session.stability}
          </Text>
        </View>
      </View>

      {/* Signal Readings */}
      {readings.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { marginTop: 14 }]}>Signal Readings</Text>
          <View style={styles.readingsCard}>
            {visibleReadings.map((log, idx) => {
              const dbm = log.signal.dbm;
              const color = getSignalColor(dbm);
              const barWidth = getBarWidth(dbm);
              const time = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const isLast = idx === visibleReadings.length - 1 && !hasMore;
              return (
                <View key={log._id || idx} style={[styles.readingRow, !isLast && styles.readingBorder]}>
                  <Text style={styles.readingTime}>{time}</Text>
                  <View style={styles.readingBarWrap}>
                    <View style={[styles.readingBar, { width: `${barWidth}%`, backgroundColor: color }]} />
                  </View>
                  <Text style={[styles.readingDbm, { color }]}>{dbm}</Text>
                </View>
              );
            })}
          </View>

          {hasMore && (
            <View style={styles.loadMoreBtn} onTouchEnd={() => setVisibleCount((c) => c + 20)}>
              <Text style={styles.loadMoreText}>Load More ({remaining} remaining)</Text>
            </View>
          )}
        </>
      )}

      {/* Save as Route */}
      {!session.routeId && (
        <View style={styles.saveBtn} onTouchEnd={onSaveAsRoute}>
          <Text style={styles.saveBtnText}>{'\uD83D\uDCCD'} Save as Route</Text>
        </View>
      )}

      {/* Bottom padding for scroll */}
      <View style={{ height: 20 }} />
    </ScrollView>
  </View>
);
```

- [ ] **Step 5: Replace the entire StyleSheet**

Replace the `const styles = StyleSheet.create({...})` block (lines 121-143) with:

```typescript
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'rgba(17,24,39,0.95)' },
  backBtn: { padding: 16, paddingTop: 12, paddingBottom: 8 },
  backText: { color: '#22C55E', fontSize: 13, fontWeight: '600' },
  content: { flex: 1, paddingHorizontal: 16 },
  sectionLabel: { color: '#6B7280', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  headerLeft: { flex: 1 },
  title: { color: '#F9FAFB', fontSize: 15, fontWeight: 'bold' },
  subtitle: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  headerDbm: { fontSize: 22, fontWeight: 'bold' },
  headerDbmLabel: { color: '#9CA3AF', fontSize: 9 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#1F2937',
    borderRadius: 10,
    marginBottom: 8,
  },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 15, fontWeight: 'bold' },
  statLabel: { color: '#9CA3AF', fontSize: 9, marginTop: 2 },
  statDivider: { width: 1, height: 24, backgroundColor: '#374151' },
  chipsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 4 },
  chip: { backgroundColor: '#1F2937', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  stabilityChip: { backgroundColor: 'rgba(234,179,8,0.1)' },
  chipText: { color: '#9CA3AF', fontSize: 10 },
  readingsCard: { backgroundColor: '#1F2937', borderRadius: 10, overflow: 'hidden' },
  readingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 12 },
  readingBorder: { borderBottomWidth: 1, borderBottomColor: '#293548' },
  readingTime: { color: '#6B7280', fontSize: 11, width: 62 },
  readingBarWrap: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#293548', marginHorizontal: 10, overflow: 'hidden' },
  readingBar: { height: 4, borderRadius: 2 },
  readingDbm: { fontSize: 12, fontWeight: 'bold', width: 40, textAlign: 'right' },
  loadMoreBtn: { padding: 12, alignItems: 'center' },
  loadMoreText: { color: '#9CA3AF', fontSize: 12 },
  saveBtn: { backgroundColor: '#22C55E', borderRadius: 10, padding: 13, alignItems: 'center', marginTop: 14 },
  saveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
```

- [ ] **Step 6: Sync to src/ and commit**

```bash
cp mobile/src/features/sessions/components/SessionDetail.tsx src/features/sessions/components/SessionDetail.tsx
git add mobile/src/features/sessions/components/SessionDetail.tsx src/features/sessions/components/SessionDetail.tsx
git commit -m "feat: redesign SessionDetail — Trip Summary layout with signal readings list"
```

---

### Task 2: Build and Test

- [ ] **Step 1: Copy to release build directory**

```bash
cp mobile/src/features/sessions/components/SessionDetail.tsx /c/sl/mobile/src/features/sessions/components/SessionDetail.tsx
```

- [ ] **Step 2: Build release APK**

```bash
cd /c/sl/mobile/android && ./gradlew.bat app:assembleRelease
```

- [ ] **Step 3: Install and test**

```bash
adb install -r /c/sl/mobile/android/app/build/outputs/apk/release/app-release.apk
```

Test checklist:
- Open app → Start mapping → Walk 30s → Stop mapping
- Go to Sessions tab → tap the session
- Verify: "Trip Summary" label, compact stats, chips
- Verify: "Signal Readings" section with progress bars
- Verify: trail draws on map
- Verify: "Save as Route" button at bottom of content
- If >20 readings: verify "Load More" button works
