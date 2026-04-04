# Signal Summary Breakdown & Tap-to-Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the Signal Summary card with per-reading breakdown rows, tap-to-map navigation, and bottom sheet hiding for a focused experience.

**Architecture:** Lazy-load individual readings from a new server endpoint when the Summary card opens. Reuse the existing `highlightReading()` WebView function for tap-to-map. Consolidate duplicated activity level constants into the shared utility before adding the new UI.

**Tech Stack:** React Native, Express/MongoDB, Leaflet WebView

---

## File Structure

| File | Responsibility |
|------|---------------|
| `mobile/src/lib/utils/activity-levels.ts` | Add `ACTIVITY_COLORS`, `ACTIVITY_SHORT` (consolidate from duplicates) |
| `server/services/signal-service.js` | Add `getReadingsByIds(ids)` MongoDB query |
| `server/routes/signals.js` | Add `GET /signals/readings?ids=...` endpoint |
| `mobile/src/lib/api/client.ts` | Add `api.signals.fetchReadingsByIds(ids)` |
| `mobile/src/features/map-view/hooks/use-map-data.ts` | Add `fetchReadings(ids)` with cache |
| `mobile/src/features/map-view/components/MapScreen.tsx` | Breakdown UI, tap-to-map, bottom sheet hide, map state save/restore |

Mirror all `mobile/src/` changes to `src/` per architecture rule.

---

### Task 1: Consolidate Activity Level Constants

Move `ACTIVITY_COLORS` and `ACTIVITY_SHORT` from duplicated component files into the shared utility.

**Files:**
- Modify: `mobile/src/lib/utils/activity-levels.ts`
- Modify: `mobile/src/features/comparison/components/RouteComparison.tsx`
- Modify: `mobile/src/features/comparison/components/LocationComparison.tsx`

- [ ] **Step 1: Add ACTIVITY_COLORS and ACTIVITY_SHORT to shared utility**

Add these exports at the end of `mobile/src/lib/utils/activity-levels.ts`:

```typescript
export const ACTIVITY_COLORS: Record<string, string> = {
  gaming: '#22C55E',
  streaming: '#84CC16',
  browsing: '#EAB308',
  messaging: '#F97316',
  dead: '#EF4444',
};

export const ACTIVITY_SHORT: Record<string, string> = {
  gaming: 'Game',
  streaming: 'Stream',
  browsing: 'Browse',
  messaging: 'Msg',
  dead: 'Dead',
};
```

- [ ] **Step 2: Update RouteComparison.tsx to import from shared utility**

In `mobile/src/features/comparison/components/RouteComparison.tsx`, remove the local `ACTIVITY_COLORS` and `ACTIVITY_SHORT` declarations (lines ~11-33) and add an import:

```typescript
import { ACTIVITY_COLORS, ACTIVITY_SHORT } from '../../../lib/utils/activity-levels';
```

Keep `ACTIVITY_LABELS` local if it's only used in that file.

- [ ] **Step 3: Update LocationComparison.tsx to import from shared utility**

In `mobile/src/features/comparison/components/LocationComparison.tsx`, remove the local `ACTIVITY_COLORS` declaration and add:

```typescript
import { ACTIVITY_COLORS } from '../../../lib/utils/activity-levels';
```

- [ ] **Step 4: Mirror all changes to `src/` directory**

Copy the same changes to:
- `src/lib/utils/activity-levels.ts`
- `src/features/comparison/components/RouteComparison.tsx`
- `src/features/comparison/components/LocationComparison.tsx`

- [ ] **Step 5: Commit**

```bash
git add mobile/src/lib/utils/activity-levels.ts src/lib/utils/activity-levels.ts \
  mobile/src/features/comparison/components/RouteComparison.tsx src/features/comparison/components/RouteComparison.tsx \
  mobile/src/features/comparison/components/LocationComparison.tsx src/features/comparison/components/LocationComparison.tsx
git commit -m "refactor: consolidate ACTIVITY_COLORS and ACTIVITY_SHORT into shared utility"
```

---

### Task 2: Server Endpoint — Get Readings by IDs

**Files:**
- Modify: `server/services/signal-service.js`
- Modify: `server/routes/signals.js`

- [ ] **Step 1: Add `getReadingsByIds` to signal-service.js**

Add this function after the existing `queryByViewport` function in `server/services/signal-service.js`:

```javascript
async function getReadingsByIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('ids must be a non-empty array');
  }
  if (ids.length > 100) {
    throw new Error('Cannot fetch more than 100 readings at once');
  }
  const ObjectId = require('mongoose').Types.ObjectId;
  const objectIds = ids.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id));
  return SignalLog.find({ _id: { $in: objectIds } })
    .sort({ timestamp: -1 })
    .lean();
}
```

Update the module exports:

```javascript
module.exports = { createBatch, queryByViewport, getReadingsByIds };
```

- [ ] **Step 2: Add GET /signals/readings route**

Add this route in `server/routes/signals.js` before `module.exports = router;`:

```javascript
router.get('/readings', async (req, res) => {
  try {
    const idsParam = req.query.ids;
    if (!idsParam) {
      return res.status(400).json({ error: 'ids query parameter is required' });
    }
    const ids = idsParam.split(',').filter(Boolean);
    const readings = await signalService.getReadingsByIds(ids);
    res.json({ readings, count: readings.length });
  } catch (err) {
    if (err.message.includes('non-empty array') || err.message.includes('exceed') || err.message.includes('Cannot fetch')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to fetch readings' });
  }
});
```

**Important:** This route must be added BEFORE the existing `router.get('/', ...)` route, otherwise Express will match `/readings` against the `/` route with `readings` as a query param.

- [ ] **Step 3: Test the endpoint manually**

Start the server and test with curl:

```bash
cd server && node index.js
# In another terminal, use a known signal ID from the database:
curl "http://localhost:3000/signals/readings?ids=SOME_REAL_ID"
```

Expected: `{ readings: [...], count: N }`

- [ ] **Step 4: Commit**

```bash
git add server/services/signal-service.js server/routes/signals.js
git commit -m "feat: add GET /signals/readings endpoint for fetching readings by IDs"
```

---

### Task 3: API Client — fetchReadingsByIds

**Files:**
- Modify: `mobile/src/lib/api/client.ts`

- [ ] **Step 1: Add fetchReadingsByIds to the signals namespace**

In `mobile/src/lib/api/client.ts`, inside the `api.signals` object (after the `query` method), add:

```typescript
    fetchReadingsByIds(ids: string[]): Promise<{ readings: SignalLog[]; count: number }> {
      const params = new URLSearchParams({ ids: ids.join(',') });
      return request(`/signals/readings?${params}`);
    },
```

- [ ] **Step 2: Mirror to `src/lib/api/client.ts`**

Copy the same change to `src/lib/api/client.ts`.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/lib/api/client.ts src/lib/api/client.ts
git commit -m "feat: add fetchReadingsByIds API client method"
```

---

### Task 4: Hook — Reading Fetch with Cache

**Files:**
- Modify: `mobile/src/features/map-view/hooks/use-map-data.ts`

- [ ] **Step 1: Add reading fetch state and cache**

Add these imports and state to `use-map-data.ts`:

At the top, add `SignalLog` to the existing import if not already there (it's already imported).

Inside the `useMapData` hook, after the existing `heatmapCache` ref, add:

```typescript
  const [breakdownReadings, setBreakdownReadings] = useState<SignalLog[]>([]);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownError, setBreakdownError] = useState(false);
  const readingsCache = useRef<Map<string, SignalLog[]>>(new Map());
```

- [ ] **Step 2: Add fetchReadings function**

After the `fetchData` callback, add:

```typescript
  const fetchReadings = useCallback(async (consolidatedId: string, readingIds: string[]) => {
    // Check cache first
    const cached = readingsCache.current.get(consolidatedId);
    if (cached) {
      setBreakdownReadings(cached);
      setBreakdownLoading(false);
      setBreakdownError(false);
      return;
    }

    setBreakdownLoading(true);
    setBreakdownError(false);
    setBreakdownReadings([]);

    try {
      const result = await api.signals.fetchReadingsByIds(readingIds);
      const sorted = result.readings.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      readingsCache.current.set(consolidatedId, sorted);
      setBreakdownReadings(sorted);
    } catch {
      setBreakdownError(true);
    } finally {
      setBreakdownLoading(false);
    }
  }, []);

  const clearBreakdown = useCallback(() => {
    setBreakdownReadings([]);
    setBreakdownLoading(false);
    setBreakdownError(false);
  }, []);
```

- [ ] **Step 3: Add to return object**

Update the return statement to include the new values:

```typescript
  return {
    signals,
    consolidated,
    reports,
    heatmapTiles,
    isLoading,
    error,
    fetchData,
    breakdownReadings,
    breakdownLoading,
    breakdownError,
    fetchReadings,
    clearBreakdown,
  };
```

- [ ] **Step 4: Mirror to `src/features/map-view/hooks/use-map-data.ts`**

Copy the same changes to the `src/` version.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/features/map-view/hooks/use-map-data.ts src/features/map-view/hooks/use-map-data.ts
git commit -m "feat: add fetchReadings with cache to useMapData hook"
```

---

### Task 5: MapScreen — Update highlightReading JS + Save/Restore Map State

**Files:**
- Modify: `mobile/src/features/map-view/components/MapScreen.tsx`

- [ ] **Step 1: Update highlightReading function in WebView HTML**

In `MapScreen.tsx`, find the `highlightReading` function in the Leaflet HTML string (around line 259). Replace:

```javascript
map.setView([lat, lng], 19, { animate: true });
```

with:

```javascript
map.setView([lat, lng], Math.max(map.getZoom(), 17), { animate: true });
```

- [ ] **Step 2: Add getMapState and restoreMapState JS functions**

In the same Leaflet HTML string, after the `highlightReading` function, add:

```javascript
function getMapState() {
  var c = map.getCenter();
  return JSON.stringify({ lat: c.lat, lng: c.lng, zoom: map.getZoom() });
}
function restoreMapState(lat, lng, zoom) {
  if (window._highlightMarker) { map.removeLayer(window._highlightMarker); window._highlightMarker = null; }
  map.setView([lat, lng], zoom, { animate: true });
}
```

- [ ] **Step 3: Add map state ref and save/restore logic**

Near the existing state declarations (around line 322), add:

```typescript
const savedMapState = useRef<{ lat: number; lng: number; zoom: number } | null>(null);
```

- [ ] **Step 4: Commit**

```bash
git add mobile/src/features/map-view/components/MapScreen.tsx
git commit -m "feat: add map state save/restore and smart zoom to highlightReading"
```

---

### Task 6: MapScreen — Bottom Sheet Hide + Signal Summary Card with Breakdown

This is the main UI task. It modifies the dotTap handler, adds bottom sheet visibility, the breakdown section, and the tap-to-map interaction.

**Files:**
- Modify: `mobile/src/features/map-view/components/MapScreen.tsx`

- [ ] **Step 1: Add new imports and state**

At the top of `MapScreen.tsx`, add to the existing imports:

```typescript
import { getActivityLevel, ACTIVITY_COLORS, ACTIVITY_SHORT } from '../../../lib/utils/activity-levels';
import { getSignalColor } from '../../../lib/config';
```

(`getSignalColor` is likely already imported — check first.)

Near the existing state declarations, add:

```typescript
const [summaryOpen, setSummaryOpen] = useState(false);
const [selectedReadingIdx, setSelectedReadingIdx] = useState<number | null>(null);
const [showAllReadings, setShowAllReadings] = useState(false);
```

Destructure the new hook values from `useMapData`:

```typescript
const {
  signals, consolidated, reports, heatmapTiles, isLoading, error, fetchData,
  breakdownReadings, breakdownLoading, breakdownError, fetchReadings, clearBreakdown,
} = useMapData();
```

- [ ] **Step 2: Update the dotTap handler for second tap**

In `handleWebViewMessage`, find the second-tap block (where `setDotDetail(data)` is called). Replace:

```typescript
// Second tap — show full detail card
setDotDetail(data);
setDotTooltip(null);
webViewRef.current?.injectJavaScript('hideTooltip(); true;');
```

with:

```typescript
// Second tap — show full detail card
setDotDetail(data);
setDotTooltip(null);
setSelectedReadingIdx(null);
setShowAllReadings(false);
webViewRef.current?.injectJavaScript('hideTooltip(); true;');

// Save map state and hide bottom sheet
webViewRef.current?.injectJavaScript(`
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapState', ...JSON.parse(getMapState()) }));
  true;
`);
setSummaryOpen(true);

// Fetch readings if consolidated
if (data.isConsolidated) {
  const c = consolidated.find((r: any) => r._id === data.id);
  if (c?.readingIds?.length) {
    fetchReadings(c._id, c.readingIds);
  }
}
```

- [ ] **Step 3: Handle mapState message**

In `handleWebViewMessage`, add a new `else if` branch after the `mapTap` handler:

```typescript
} else if (data.type === 'mapState') {
  savedMapState.current = { lat: data.lat, lng: data.lng, zoom: data.zoom };
}
```

- [ ] **Step 4: Update the close handler**

Replace the existing close `onTouchEnd` on the dotDetail card:

```typescript
onTouchEnd={() => { setDotDetail(null); webViewRef.current?.injectJavaScript('hideTooltip(); true;'); }}
```

with:

```typescript
onTouchEnd={() => {
  setDotDetail(null);
  setSummaryOpen(false);
  setSelectedReadingIdx(null);
  setShowAllReadings(false);
  clearBreakdown();
  if (savedMapState.current) {
    const { lat, lng, zoom } = savedMapState.current;
    webViewRef.current?.injectJavaScript(`restoreMapState(${lat},${lng},${zoom}); true;`);
    savedMapState.current = null;
  }
}}
```

- [ ] **Step 5: Also update the mapTap dismiss handler**

In the `mapTap` handler, where `setDotDetail(null)` is called, add the same restore logic:

```typescript
if (dotTooltip || dotDetail) {
  setDotTooltip(null);
  setDotDetail(null);
  setSummaryOpen(false);
  setSelectedReadingIdx(null);
  setShowAllReadings(false);
  clearBreakdown();
  if (savedMapState.current) {
    const { lat, lng, zoom } = savedMapState.current;
    webViewRef.current?.injectJavaScript(`restoreMapState(${lat},${lng},${zoom}); true;`);
    savedMapState.current = null;
  }
  webViewRef.current?.injectJavaScript('hideTooltip(); true;');
}
```

- [ ] **Step 6: Hide bottom sheet when summaryOpen**

Wrap the existing `<SwipeableSheet>` component with a conditional:

```tsx
{!summaryOpen && (
  <SwipeableSheet ... >
    {/* existing tab content */}
  </SwipeableSheet>
)}
```

- [ ] **Step 7: Add the Signal Breakdown UI**

Inside the `dotDetail` rendering block, after the existing range bar section (`dotDetailRange`) and before the close button, add the breakdown section:

```tsx
{dotDetail.isConsolidated && (
  <View style={styles.breakdownSection}>
    <Text style={styles.breakdownLabel}>SIGNAL BREAKDOWN</Text>
    {breakdownLoading ? (
      // Skeleton rows
      <>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.skeletonRow}>
            <View style={[styles.skeletonBlock, { width: 65 }]} />
            <View style={[styles.skeletonBlock, { flex: 1, marginHorizontal: 8 }]} />
            <View style={[styles.skeletonBlock, { width: 32 }]} />
          </View>
        ))}
      </>
    ) : breakdownError ? (
      <Text style={styles.breakdownErrorText}>Readings unavailable offline</Text>
    ) : (
      <>
        <ScrollView style={showAllReadings ? { maxHeight: 200 } : undefined} nestedScrollEnabled>
          {(showAllReadings ? breakdownReadings.slice(0, 50) : breakdownReadings.slice(0, 5)).map((reading: any, idx: number) => {
            const dbm = reading.signal?.dbm ?? reading.dbm;
            const color = getSignalColor(dbm);
            const normalized = Math.max(0, Math.min(1, (dbm + 120) / 70)) * 100;
            const activity = getActivityLevel(dbm);
            const isSelected = selectedReadingIdx === idx;
            const hasCoords = reading.location?.coordinates?.length === 2;
            const ts = new Date(reading.timestamp);
            const timeLabel = `${ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${ts.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
            const connLabel = reading.connectionType === 'wifi'
              ? 'WiFi'
              : `${reading.carrier || ''} · ${reading.networkType || ''}`;

            return (
              <View
                key={reading._id || idx}
                style={[
                  styles.breakdownRow,
                  idx < (showAllReadings ? Math.min(breakdownReadings.length, 50) : Math.min(breakdownReadings.length, 5)) - 1 && styles.breakdownRowBorder,
                  isSelected && styles.breakdownRowSelected,
                ]}
                onTouchEnd={hasCoords ? () => {
                  setSelectedReadingIdx(idx);
                  const [lng, lat] = reading.location.coordinates;
                  webViewRef.current?.injectJavaScript(
                    `highlightReading(${lat},${lng},'${color}'); true;`
                  );
                } : undefined}
              >
                <Text style={[styles.breakdownTime, isSelected && { color: '#93C5FD' }]}>{timeLabel}</Text>
                <View style={styles.breakdownBarWrap}>
                  <View style={[styles.breakdownBar, { width: `${normalized}%`, backgroundColor: color }]} />
                </View>
                <Text style={[styles.breakdownDbm, { color }]}>{dbm}</Text>
                <Text style={[styles.breakdownBadge, { color: activity.color, backgroundColor: `${activity.color}15` }]}>
                  {ACTIVITY_SHORT[activity.level]}
                </Text>
              </View>
            );
          })}
        </ScrollView>
        {!showAllReadings && breakdownReadings.length > 5 && (
          <View style={styles.showAllBtn} onTouchEnd={() => setShowAllReadings(true)}>
            <Text style={styles.showAllText}>Show all ({breakdownReadings.length})</Text>
          </View>
        )}
      </>
    )}
  </View>
)}
```

- [ ] **Step 8: Add range bar marker for selected reading**

In the existing range bar rendering (inside the `dotDetailRange` section), after the gradient bar `<View style={styles.dotDetailBarGradient} />`, add a conditional marker:

```tsx
{selectedReadingIdx !== null && breakdownReadings[selectedReadingIdx] && (() => {
  const selDbm = breakdownReadings[selectedReadingIdx].signal?.dbm ?? breakdownReadings[selectedReadingIdx].dbm;
  const markerPos = Math.max(0, Math.min(1, (selDbm + 120) / 70)) * 100;
  return (
    <View style={[styles.rangeMarker, { left: `${markerPos}%` }]} />
  );
})()}
```

Make sure the parent `dotDetailBar` view has `position: 'relative'` (it may need updating).

- [ ] **Step 9: Commit**

```bash
git add mobile/src/features/map-view/components/MapScreen.tsx
git commit -m "feat: add signal breakdown UI with tap-to-map and bottom sheet hiding"
```

---

### Task 7: MapScreen — Add Styles

**Files:**
- Modify: `mobile/src/features/map-view/components/MapScreen.tsx`

- [ ] **Step 1: Add all new styles**

Add these to the existing `StyleSheet.create({})` block:

```typescript
  // Breakdown section
  breakdownSection: { marginBottom: 12 },
  breakdownLabel: { color: '#6B7280', fontSize: 10, fontWeight: '600', letterSpacing: 1.5, textTransform: 'uppercase' as const, marginBottom: 6 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10 },
  breakdownRowBorder: { borderBottomWidth: 1, borderBottomColor: '#293548' },
  breakdownRowSelected: { backgroundColor: 'rgba(59,130,246,0.15)', borderLeftWidth: 3, borderLeftColor: '#3B82F6' },
  breakdownTime: { color: '#6B7280', fontSize: 10, width: 80 },
  breakdownBarWrap: { flex: 1, height: 4, backgroundColor: '#293548', borderRadius: 2, marginHorizontal: 6, overflow: 'hidden' },
  breakdownBar: { height: 4, borderRadius: 2 },
  breakdownDbm: { fontSize: 12, fontWeight: '700', width: 34, textAlign: 'right' as const },
  breakdownBadge: { fontSize: 8, fontWeight: '600', paddingVertical: 1, paddingHorizontal: 5, borderRadius: 4, marginLeft: 6, overflow: 'hidden' },
  breakdownErrorText: { color: '#6B7280', fontSize: 12, textAlign: 'center' as const, paddingVertical: 16 },
  showAllBtn: { paddingVertical: 8, alignItems: 'center' as const },
  showAllText: { color: '#6B7280', fontSize: 11 },

  // Skeleton loading rows
  skeletonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10 },
  skeletonBlock: { height: 10, backgroundColor: '#1F2937', borderRadius: 4, opacity: 0.6 },

  // Range bar marker
  rangeMarker: { position: 'absolute', top: -3, width: 2, height: 12, backgroundColor: '#FFFFFF', borderRadius: 1 },
```

Update the existing `dotDetailBar` style to include `position: 'relative'`:

```typescript
  dotDetailBar: { height: 6, borderRadius: 3, overflow: 'hidden', position: 'relative' },
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/features/map-view/components/MapScreen.tsx
git commit -m "feat: add breakdown and skeleton styles to MapScreen"
```

---

### Task 8: Mirror Mobile Changes to src/

**Files:**
- Mirror: `mobile/src/features/map-view/components/MapScreen.tsx` → `src/features/map-view/components/MapScreen.tsx`
- Mirror: `mobile/src/features/map-view/hooks/use-map-data.ts` → `src/features/map-view/hooks/use-map-data.ts`
- Mirror: `mobile/src/lib/api/client.ts` → `src/lib/api/client.ts`

- [ ] **Step 1: Copy all modified mobile files to src/**

```bash
cp mobile/src/features/map-view/components/MapScreen.tsx src/features/map-view/components/MapScreen.tsx
cp mobile/src/features/map-view/hooks/use-map-data.ts src/features/map-view/hooks/use-map-data.ts
cp mobile/src/lib/api/client.ts src/lib/api/client.ts
```

- [ ] **Step 2: Commit**

```bash
git add src/features/map-view/components/MapScreen.tsx src/features/map-view/hooks/use-map-data.ts src/lib/api/client.ts
git commit -m "chore: sync mobile changes to src/ directory"
```

---

### Task 9: Manual Testing

- [ ] **Step 1: Start server and app**

```bash
cd server && node index.js
# In another terminal:
cd mobile && npx react-native start
# Device setup:
adb reverse tcp:3000 tcp:3000 && adb reverse tcp:8081 tcp:8081
```

- [ ] **Step 2: Test the full flow**

1. Open the map, zoom to an area with consolidated dots
2. **Single tap** a consolidated dot → verify tooltip appears (unchanged)
3. **Double tap** the same dot → verify:
   - Tooltip dismisses
   - Bottom sheet (Live/Sessions/Routes) hides
   - Signal Summary card appears with header + range bar
   - Skeleton rows appear briefly
   - Breakdown rows load with timestamp, signal bar, dBm, activity badge
4. **Tap a reading row** → verify:
   - Row highlights blue with left border
   - Map pans to that reading's location
   - Highlighted marker appears (12px, white border)
   - White marker appears on range bar
5. **Tap another row** → verify previous highlight clears, new one appears
6. **Tap "Show all"** (if >5 readings) → verify scrollable list appears
7. **Tap "Close"** → verify:
   - Summary card dismisses
   - Bottom sheet returns
   - Map restores to original position/zoom
   - Highlight marker removed
8. **Tap the map** (outside card) → verify same close behavior

- [ ] **Step 3: Test edge cases**

1. Open Summary, tap Close without selecting any reading → map should not change
2. Consolidated dot with only 2 readings → "Show all" should not appear
3. Kill server, open a consolidated dot → skeleton → "Readings unavailable offline" message
4. Open same dot twice → second time should load from cache (instant, no skeleton)
5. WiFi reading in breakdown → should show "WiFi" not carrier name

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```
