# Signal Dot Consolidation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-consolidate nearby signal readings on the map after 24 hours to reduce clutter, with tappable dots showing signal info via tooltip and detail card.

**Architecture:** Server-side consolidation worker (cron job) groups old readings by carrier + networkType + location grid cell into ConsolidatedSignal records. Client fetches both fresh individual signals and consolidated records, renders them differently on the Leaflet map. Tapping a dot shows a tooltip; tapping again shows a full detail card. Local consolidation mirrors the logic for offline use.

**Tech Stack:** MongoDB aggregation pipeline, node-cron, Leaflet (WebView), React Native, AsyncStorage

**Important:** After modifying any file in `mobile/src/`, copy it to `src/`. For release builds, copy changed files to `C:\sl\`. Server changes push to GitHub for auto-deploy on Render.

---

### Task 1: ConsolidatedSignal Model

**Files:**
- Create: `server/models/consolidated-signal.js`

- [ ] **Step 1: Create the Mongoose model**

```javascript
// server/models/consolidated-signal.js
const mongoose = require('mongoose');

const consolidatedSignalSchema = new mongoose.Schema({
  location: {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true },
  },
  carrier: { type: String, required: true, index: true },
  networkType: { type: String, required: true, index: true },
  avgDbm: { type: Number, required: true },
  minDbm: { type: Number, required: true },
  maxDbm: { type: Number, required: true },
  count: { type: Number, required: true },
  firstTimestamp: { type: Date, required: true },
  lastTimestamp: { type: Date, required: true },
  readingIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SignalLog' }],
  cellLat: { type: Number, required: true },
  cellLng: { type: Number, required: true },
});

consolidatedSignalSchema.index({ location: '2dsphere' });
consolidatedSignalSchema.index({ cellLat: 1, cellLng: 1, carrier: 1, networkType: 1 }, { unique: true });

module.exports = mongoose.model('ConsolidatedSignal', consolidatedSignalSchema);
```

- [ ] **Step 2: Add `consolidated` flag to SignalLog model**

In `server/models/signal-log.js`, add after the `synced` field (line 52):

```javascript
  consolidated: {
    type: Boolean,
    default: false,
    index: true,
  },
```

---

### Task 2: Server Consolidation Worker

**Files:**
- Create: `server/workers/consolidation-worker.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create the consolidation worker**

```javascript
// server/workers/consolidation-worker.js
const cron = require('node-cron');
const SignalLog = require('../models/signal-log');
const ConsolidatedSignal = require('../models/consolidated-signal');

const CELL_SIZE = 0.0005; // ~50 meters

function toCell(val) {
  return Math.round(val / CELL_SIZE) * CELL_SIZE;
}

async function consolidate() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const pipeline = [
    {
      $match: {
        timestamp: { $lt: cutoff },
        consolidated: { $ne: true },
        'connection.isWifi': { $ne: true },
      },
    },
    {
      $addFields: {
        cellLng: {
          $multiply: [
            { $round: [{ $divide: [{ $arrayElemAt: ['$location.coordinates', 0] }, CELL_SIZE] }, 0] },
            CELL_SIZE,
          ],
        },
        cellLat: {
          $multiply: [
            { $round: [{ $divide: [{ $arrayElemAt: ['$location.coordinates', 1] }, CELL_SIZE] }, 0] },
            CELL_SIZE,
          ],
        },
      },
    },
    {
      $group: {
        _id: {
          cellLng: '$cellLng',
          cellLat: '$cellLat',
          carrier: '$carrier',
          networkType: '$networkType',
        },
        avgDbm: { $avg: '$signal.dbm' },
        minDbm: { $min: '$signal.dbm' },
        maxDbm: { $max: '$signal.dbm' },
        count: { $sum: 1 },
        firstTimestamp: { $min: '$timestamp' },
        lastTimestamp: { $max: '$timestamp' },
        readingIds: { $push: '$_id' },
        avgLng: { $avg: { $arrayElemAt: ['$location.coordinates', 0] } },
        avgLat: { $avg: { $arrayElemAt: ['$location.coordinates', 1] } },
      },
    },
    {
      $match: { count: { $gte: 2 } },
    },
  ];

  const groups = await SignalLog.aggregate(pipeline);
  let created = 0;

  for (const g of groups) {
    await ConsolidatedSignal.findOneAndUpdate(
      {
        cellLat: parseFloat(g._id.cellLat.toFixed(6)),
        cellLng: parseFloat(g._id.cellLng.toFixed(6)),
        carrier: g._id.carrier,
        networkType: g._id.networkType,
      },
      {
        location: {
          type: 'Point',
          coordinates: [parseFloat(g.avgLng.toFixed(6)), parseFloat(g.avgLat.toFixed(6))],
        },
        avgDbm: Math.round(g.avgDbm),
        minDbm: g.minDbm,
        maxDbm: g.maxDbm,
        count: g.count,
        firstTimestamp: g.firstTimestamp,
        lastTimestamp: g.lastTimestamp,
        readingIds: g.readingIds.slice(0, 100),
      },
      { upsert: true },
    );

    // Mark original readings as consolidated
    await SignalLog.updateMany(
      { _id: { $in: g.readingIds } },
      { $set: { consolidated: true } },
    );

    created++;
  }

  console.log(`[Consolidation] ${created} groups consolidated at ${new Date().toISOString()}`);
}

function start() {
  console.log('[Consolidation] Scheduled: every hour');
  cron.schedule('0 * * * *', consolidate);
}

module.exports = { start, consolidate };
```

- [ ] **Step 2: Register worker in server/index.js**

After line 15 (`require('./workers/heatmap-aggregator').start();`), add:

```javascript
    require('./workers/consolidation-worker').start();
```

---

### Task 3: Server API for Consolidated + Fresh Signals

**Files:**
- Modify: `server/services/signal-service.js`

- [ ] **Step 1: Update queryByViewport to separate fresh and consolidated**

Replace the entire `server/services/signal-service.js`:

```javascript
const SignalLog = require('../models/signal-log');
const ConsolidatedSignal = require('../models/consolidated-signal');

async function createBatch(signals) {
  if (!Array.isArray(signals) || signals.length === 0) {
    throw new Error('signals must be a non-empty array');
  }
  if (signals.length > 100) {
    throw new Error('Batch size cannot exceed 100');
  }
  return SignalLog.insertMany(signals);
}

async function queryByViewport(bounds, filters = {}) {
  const geoQuery = {
    location: {
      $geoWithin: {
        $box: [bounds.sw, bounds.ne],
      },
    },
  };

  const carrierFilter = {};
  if (filters.carrier && filters.carrier.length > 0) {
    carrierFilter.carrier = { $in: filters.carrier.map((c) => new RegExp(`^${c}$`, 'i')) };
  }
  if (filters.networkType && filters.networkType.length > 0) {
    carrierFilter.networkType = { $in: filters.networkType };
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Fresh signals (< 24h, not consolidated)
  const freshQuery = {
    ...geoQuery,
    ...carrierFilter,
    timestamp: { $gte: cutoff },
  };
  const fresh = await SignalLog.find(freshQuery).sort({ timestamp: -1 }).limit(200).lean();

  // Consolidated signals
  const consolidatedQuery = {
    ...geoQuery,
    ...carrierFilter,
  };
  const consolidated = await ConsolidatedSignal.find(consolidatedQuery).limit(300).lean();

  return { fresh, consolidated };
}

module.exports = { createBatch, queryByViewport };
```

- [ ] **Step 2: Update signals route to return new format**

Replace `server/routes/signals.js` GET handler (line 19-26):

```javascript
router.get('/', validateBounds, parseFilters, async (req, res) => {
  try {
    const { fresh, consolidated } = await signalService.queryByViewport(req.bounds, req.filters);
    res.json({
      data: fresh,
      consolidated: consolidated,
      count: fresh.length,
      consolidatedCount: consolidated.length,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to query signals' });
  }
});
```

---

### Task 4: Client — Fetch and Render Consolidated Dots

**Files:**
- Modify: `mobile/src/features/map-view/hooks/use-map-data.ts`
- Modify: `mobile/src/features/map-view/components/MapScreen.tsx`

- [ ] **Step 1: Update use-map-data to handle consolidated data**

In `mobile/src/features/map-view/hooks/use-map-data.ts`, add consolidated state and update fetchData:

Add after the `signals` state (line 30):

```typescript
const [consolidated, setConsolidated] = useState<any[]>([]);
```

Update the zoom >= 14 server fetch (inside the `.then()` callback):

```typescript
          Promise.all([
            api.signals.query(bounds, filters),
            api.reports.query(bounds, filters),
          ]).then(([signalRes, reportRes]) => {
            const merged = mergeSignals(filtered, signalRes.data);
            setSignals(merged);
            setConsolidated(signalRes.consolidated || []);
            setReports(reportRes.data);
            setHeatmapTiles([]);
          }).catch(() => {});
```

Add `consolidated` to the return:

```typescript
  return {
    signals,
    consolidated,
    reports,
    heatmapTiles,
    isLoading,
    error,
    fetchData,
  };
```

- [ ] **Step 2: Add WebView JS functions for consolidated markers and tooltips**

In MapScreen.tsx, inside the WebView HTML (after the `addMarker` function around line 111), add:

```javascript
    function addConsolidatedMarker(lat, lng, color, count, id) {
      var icon = L.divIcon({
        className: 'consolidated-marker',
        html: '<div style="position:relative;width:18px;height:18px;">' +
          '<div style="width:18px;height:18px;border-radius:50%;background:' + color + ';border:2px solid rgba(255,255,255,0.6);box-shadow:0 0 8px ' + color + '66;"></div>' +
          '<div style="position:absolute;top:-6px;right:-8px;background:#111827;color:#fff;font-size:7px;padding:1px 3px;border-radius:3px;min-width:12px;text-align:center">' + count + '×</div>' +
          '</div>',
        iconSize: [18, 18],
      });
      var m = L.marker([lat, lng], { icon: icon }).addTo(map);
      m._signalogId = id;
      m._isConsolidated = true;
      m.on('click', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'dotTap', id: id, isConsolidated: true, lat: lat, lng: lng
        }));
      });
      markers.push(m);
    }

    var tooltipLayer = null;
    function showTooltip(lat, lng, html) {
      hideTooltip();
      tooltipLayer = L.popup({ closeButton: false, className: 'signal-tooltip', offset: [0, -12] })
        .setLatLng([lat, lng])
        .setContent(html)
        .openOn(map);
    }

    function hideTooltip() {
      if (tooltipLayer) { map.closePopup(tooltipLayer); tooltipLayer = null; }
    }
```

Also update `addMarker` to support tap:

```javascript
    function addMarker(lat, lng, color, id) {
      var icon = L.divIcon({
        className: 'signal-marker',
        html: '<div style="width:10px;height:10px;border-radius:50%;background:' + color + ';border:1.5px solid rgba(255,255,255,0.3);box-shadow:0 0 6px ' + color + '44;"></div>',
        iconSize: [10, 10],
      });
      var m = L.marker([lat, lng], { icon: icon }).addTo(map);
      if (id) {
        m._signalogId = id;
        m._isConsolidated = false;
        m.on('click', function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'dotTap', id: id, isConsolidated: false, lat: lat, lng: lng
          }));
        });
      }
      markers.push(m);
    }
```

Add tooltip CSS to the WebView `<style>` section:

```css
    .signal-tooltip .leaflet-popup-content-wrapper {
      background: #111827;
      border: 1px solid #374151;
      border-radius: 10px;
      color: #F9FAFB;
      padding: 0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    }
    .signal-tooltip .leaflet-popup-tip {
      background: #111827;
      border-right: 1px solid #374151;
      border-bottom: 1px solid #374151;
    }
    .signal-tooltip .leaflet-popup-content {
      margin: 8px 12px;
      font-size: 11px;
      line-height: 1.4;
    }
```

- [ ] **Step 3: Update overlay rendering to include consolidated dots**

In MapScreen.tsx, update the `updateOverlays` function to render both fresh and consolidated:

```typescript
  const { signals, consolidated, heatmapTiles, fetchData } = useMapData();
```

In the `updateOverlays` callback, after adding fresh markers, add consolidated ones:

```typescript
      // Fresh dots
      signals.forEach((sig) => {
        const color = getSignalColor(sig.signal.dbm);
        js += `addMarker(${sig.location.coordinates[1]},${sig.location.coordinates[0]},'${color}','${sig._id}');`;
      });

      // Consolidated dots
      consolidated.forEach((c) => {
        const color = getSignalColor(c.avgDbm);
        js += `addConsolidatedMarker(${c.location.coordinates[1]},${c.location.coordinates[0]},'${color}',${c.count},'${c._id}');`;
      });
```

Update `updateOverlays` dependencies to include `consolidated`.

---

### Task 5: Client — Tooltip and Detail Card

**Files:**
- Modify: `mobile/src/features/map-view/components/MapScreen.tsx`

- [ ] **Step 1: Add state for tooltip and detail card**

```typescript
const [dotDetail, setDotDetail] = useState<any>(null);
const [dotTooltip, setDotTooltip] = useState<any>(null);
```

- [ ] **Step 2: Handle dotTap messages from WebView**

In `handleWebViewMessage`, add a case for `dotTap`:

```typescript
        } else if (data.type === 'dotTap') {
          if (dotTooltip && dotTooltip.id === data.id) {
            // Second tap — show full detail card
            setDotDetail(data);
            setDotTooltip(null);
            webViewRef.current?.injectJavaScript('hideTooltip(); true;');
          } else {
            // First tap — show tooltip
            setDotTooltip(data);
            setDotDetail(null);
            const tooltipHtml = data.isConsolidated
              ? buildConsolidatedTooltip(data, consolidated)
              : buildFreshTooltip(data, signals);
            webViewRef.current?.injectJavaScript(
              `showTooltip(${data.lat},${data.lng},'${tooltipHtml.replace(/'/g, "\\'")}'); true;`
            );
          }
```

- [ ] **Step 3: Add tooltip HTML builder functions**

Before the component return, add:

```typescript
  function buildFreshTooltip(data: any, signals: any[]): string {
    const sig = signals.find((s) => s._id === data.id);
    if (!sig) return '';
    const color = getSignalColor(sig.signal.dbm);
    const time = new Date(sig.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `<div style="font-size:11px"><span style="color:${color};font-size:15px;font-weight:bold">${sig.signal.dbm}</span> <span style="color:#9CA3AF">dBm</span><br/><span style="color:#9CA3AF">${sig.carrier} · ${sig.networkType}</span><br/><span style="color:#6B7280;font-size:9px">${time}</span></div>`;
  }

  function buildConsolidatedTooltip(data: any, consolidated: any[]): string {
    const c = consolidated.find((r) => r._id === data.id);
    if (!c) return '';
    const color = getSignalColor(c.avgDbm);
    const first = new Date(c.firstTimestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
    const last = new Date(c.lastTimestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `<div style="font-size:11px"><span style="color:${color};font-size:15px;font-weight:bold">${c.avgDbm}</span> <span style="color:#9CA3AF">avg dBm</span><br/><span style="color:#9CA3AF">${c.carrier} · ${c.networkType} · ${c.count} readings</span><br/><span style="color:#6B7280;font-size:9px">Range: ${c.maxDbm} to ${c.minDbm}</span><br/><span style="color:#6B7280;font-size:9px">${first} — ${last}</span></div>`;
  }
```

- [ ] **Step 4: Add Detail Card component**

After the session detail overlay in the JSX, add:

```tsx
      {/* Signal dot detail card */}
      {dotDetail && (
        <View style={styles.dotDetailOverlay}>
          <View style={styles.dotDetailCard}>
            <View style={styles.dotDetailHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dotDetailTitle}>{dotDetail.isConsolidated ? 'Signal Summary' : 'Signal Reading'}</Text>
                <Text style={styles.dotDetailSub}>
                  {(() => {
                    const item = dotDetail.isConsolidated
                      ? consolidated.find((c) => c._id === dotDetail.id)
                      : signals.find((s) => s._id === dotDetail.id);
                    if (!item) return '';
                    return dotDetail.isConsolidated
                      ? `${item.carrier} · ${item.networkType} · ${item.count} readings`
                      : `${item.carrier} · ${item.networkType}`;
                  })()}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {(() => {
                  const item = dotDetail.isConsolidated
                    ? consolidated.find((c) => c._id === dotDetail.id)
                    : signals.find((s) => s._id === dotDetail.id);
                  const dbm = item ? (dotDetail.isConsolidated ? item.avgDbm : item.signal.dbm) : 0;
                  return (
                    <>
                      <Text style={[styles.dotDetailDbm, { color: getSignalColor(dbm) }]}>{dbm}</Text>
                      <Text style={styles.dotDetailDbmLabel}>{dotDetail.isConsolidated ? 'avg dBm' : 'dBm'}</Text>
                    </>
                  );
                })()}
              </View>
            </View>
            {dotDetail.isConsolidated && (() => {
              const c = consolidated.find((r) => r._id === dotDetail.id);
              if (!c) return null;
              return (
                <View style={styles.dotDetailRange}>
                  <View style={styles.dotDetailRangeLabels}>
                    <Text style={[styles.dotDetailRangeText, { color: '#22C55E' }]}>Best: {c.maxDbm}</Text>
                    <Text style={[styles.dotDetailRangeText, { color: '#EF4444' }]}>Worst: {c.minDbm}</Text>
                  </View>
                  <View style={styles.dotDetailBar}>
                    <View style={styles.dotDetailBarGradient} />
                  </View>
                </View>
              );
            })()}
            <View style={styles.dotDetailClose} onTouchEnd={() => { setDotDetail(null); webViewRef.current?.injectJavaScript('hideTooltip(); true;'); }}>
              <Text style={styles.dotDetailCloseText}>Close</Text>
            </View>
          </View>
        </View>
      )}
```

- [ ] **Step 5: Add styles for detail card**

```typescript
  dotDetailOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 24 },
  dotDetailCard: { backgroundColor: '#111827', borderRadius: 14, borderWidth: 1, borderColor: '#374151', padding: 16 },
  dotDetailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dotDetailTitle: { color: '#F9FAFB', fontSize: 15, fontWeight: 'bold' },
  dotDetailSub: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },
  dotDetailDbm: { fontSize: 22, fontWeight: 'bold' },
  dotDetailDbmLabel: { color: '#9CA3AF', fontSize: 9 },
  dotDetailRange: { backgroundColor: '#1F2937', borderRadius: 8, padding: 10, marginBottom: 12 },
  dotDetailRangeLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  dotDetailRangeText: { fontSize: 10 },
  dotDetailBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  dotDetailBarGradient: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#EAB308', background: 'linear-gradient(to right, #22C55E, #EAB308, #EF4444)' },
  dotDetailClose: { padding: 8, alignItems: 'center' },
  dotDetailCloseText: { color: '#9CA3AF', fontSize: 13 },
```

---

### Task 6: Local Consolidation (Offline)

**Files:**
- Modify: `mobile/src/features/offline-sync/services/log-store.ts`
- Modify: `mobile/src/features/map-view/hooks/use-map-data.ts`

- [ ] **Step 1: Add local consolidation function to log-store**

```typescript
export interface LocalConsolidated {
  location: { type: 'Point'; coordinates: [number, number] };
  carrier: string;
  networkType: string;
  avgDbm: number;
  minDbm: number;
  maxDbm: number;
  count: number;
  firstTimestamp: string;
  lastTimestamp: string;
}

export async function getLocalConsolidated(swLng: number, swLat: number, neLng: number, neLat: number): Promise<LocalConsolidated[]> {
  const signals = await loadSignals();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const CELL = 0.0005;

  const groups = new Map<string, { lngs: number[]; lats: number[]; dbms: number[]; timestamps: number[]; carrier: string; networkType: string }>();

  for (const s of signals) {
    if (!s.location?.coordinates) continue;
    const [lng, lat] = s.location.coordinates;
    if (lng < swLng || lng > neLng || lat < swLat || lat > neLat) continue;
    if (new Date(s.timestamp).getTime() > cutoff) continue;
    if (s.connection?.isWifi) continue;

    const cellLng = Math.round(lng / CELL) * CELL;
    const cellLat = Math.round(lat / CELL) * CELL;
    const key = `${cellLng.toFixed(4)}_${cellLat.toFixed(4)}_${s.carrier}_${s.networkType}`;

    if (!groups.has(key)) {
      groups.set(key, { lngs: [], lats: [], dbms: [], timestamps: [], carrier: s.carrier, networkType: s.networkType });
    }
    const g = groups.get(key)!;
    g.lngs.push(lng);
    g.lats.push(lat);
    g.dbms.push(s.signal.dbm);
    g.timestamps.push(new Date(s.timestamp).getTime());
  }

  const result: LocalConsolidated[] = [];
  for (const g of groups.values()) {
    if (g.dbms.length < 2) continue;
    const avgLng = g.lngs.reduce((a, b) => a + b, 0) / g.lngs.length;
    const avgLat = g.lats.reduce((a, b) => a + b, 0) / g.lats.length;
    result.push({
      location: { type: 'Point', coordinates: [avgLng, avgLat] },
      carrier: g.carrier,
      networkType: g.networkType,
      avgDbm: Math.round(g.dbms.reduce((a, b) => a + b, 0) / g.dbms.length),
      minDbm: Math.min(...g.dbms),
      maxDbm: Math.max(...g.dbms),
      count: g.dbms.length,
      firstTimestamp: new Date(Math.min(...g.timestamps)).toISOString(),
      lastTimestamp: new Date(Math.max(...g.timestamps)).toISOString(),
    });
  }
  return result;
}
```

- [ ] **Step 2: Update use-map-data to use local consolidation**

In `use-map-data.ts`, import `getLocalConsolidated` and update the zoom >= 14 block to load local consolidated first:

```typescript
import { getLocalSignals, getLocalConsolidated } from '../../offline-sync/services/log-store';
```

In the fetchData zoom >= 14 section, after loading local fresh signals:

```typescript
          // Load local consolidated (instant)
          const localConsolidated = await getLocalConsolidated(bounds.sw[0], bounds.sw[1], bounds.ne[0], bounds.ne[1]);
          if (localConsolidated.length > 0) {
            setConsolidated(localConsolidated);
          }
```

- [ ] **Step 3: Sync all files and commit**

```bash
cp mobile/src/features/offline-sync/services/log-store.ts src/features/offline-sync/services/log-store.ts
cp mobile/src/features/map-view/hooks/use-map-data.ts src/features/map-view/hooks/use-map-data.ts
cp mobile/src/features/map-view/components/MapScreen.tsx src/features/map-view/components/MapScreen.tsx
```

Push server changes:
```bash
git add server/ mobile/src/ src/
git commit -m "feat: signal dot consolidation — server worker + client rendering + tooltips"
git push origin master
```
