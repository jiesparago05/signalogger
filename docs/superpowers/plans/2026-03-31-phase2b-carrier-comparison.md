# Phase 2b: Carrier Comparison Tool — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a carrier comparison tool that ranks carriers by signal strength for routes, current location, and searched areas.

**Architecture:** A new compare-service queries existing SignalHistory tiles, groups by carrier, and returns rankings with activity levels. The mobile app adds comparison UI screens accessible from route detail, bottom sheet, and a map tap handler. Area search uses Nominatim geocoding.

**Tech Stack:** MongoDB (existing SignalHistory), Express, React Native, Leaflet WebView, Nominatim API (geocoding)

---

## File Structure

### Backend

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `server/services/compare-service.js` | Route comparison + location comparison logic |
| Create | `server/routes/compare.js` | Comparison API endpoints |
| Modify | `server/app.js` | Register compare router |

### Mobile App

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/features/comparison/hooks/use-comparison.ts` | Fetch comparison data from API |
| Create | `src/features/comparison/components/RouteComparison.tsx` | Full-screen route comparison (ranking + segments) |
| Create | `src/features/comparison/components/LocationComparison.tsx` | Carrier comparison popup for a location |
| Create | `src/features/comparison/components/SearchBar.tsx` | Area search with Nominatim autocomplete |
| Modify | `src/lib/api/client.ts` | Add compare API methods |
| Modify | `src/features/routes/components/RouteDetail.tsx` | Add "Compare Carriers" button |
| Modify | `src/features/map-view/components/MapScreen.tsx` | Add Compare Here button, tap handler, SearchBar, popup |

---

## Task 1: Backend — Compare Service + Routes

**Files:**
- Create: `server/services/compare-service.js`
- Create: `server/routes/compare.js`
- Modify: `server/app.js`

- [ ] **Step 1: Create compare-service.js**

```javascript
// server/services/compare-service.js
const SignalHistory = require('../models/signal-history');
const CommuteRoute = require('../models/commute-route');

function getActivityLevel(avgDbm) {
  if (avgDbm >= -75) return 'gaming';
  if (avgDbm >= -85) return 'streaming';
  if (avgDbm >= -95) return 'browsing';
  if (avgDbm >= -105) return 'messaging';
  return 'dead';
}

async function compareRoute(routeId) {
  const route = await CommuteRoute.findById(routeId).lean();
  if (!route) throw new Error('Route not found');

  const bufferDeg = 0.01; // ~1km buffer

  // For each segment, find SignalHistory tiles nearby and group by carrier
  const segments = [];
  const carrierTotals = {};

  for (const seg of route.segments) {
    const centerLng = (seg.startLocation.coordinates[0] + seg.endLocation.coordinates[0]) / 2;
    const centerLat = (seg.startLocation.coordinates[1] + seg.endLocation.coordinates[1]) / 2;

    const tiles = await SignalHistory.aggregate([
      {
        $match: {
          swLng: { $lte: centerLng + bufferDeg },
          neLng: { $gte: centerLng - bufferDeg },
          swLat: { $lte: centerLat + bufferDeg },
          neLat: { $gte: centerLat - bufferDeg },
        },
      },
      {
        $group: {
          _id: '$carrier',
          avgDbm: { $avg: '$avgDbm' },
          sampleCount: { $sum: '$sampleCount' },
        },
      },
      { $sort: { avgDbm: -1 } },
    ]);

    const carriers = tiles.map((t) => {
      const avgDbm = Math.round(t.avgDbm);
      // Accumulate for overall ranking
      if (!carrierTotals[t._id]) carrierTotals[t._id] = { sum: 0, count: 0, samples: 0 };
      carrierTotals[t._id].sum += t.avgDbm;
      carrierTotals[t._id].count += 1;
      carrierTotals[t._id].samples += t.sampleCount;

      return {
        carrier: t._id,
        avgDbm,
        activityLevel: getActivityLevel(avgDbm),
      };
    });

    segments.push({
      label: seg.label,
      distanceMeters: seg.distanceMeters,
      carriers,
    });
  }

  // Compute overall ranking
  const ranking = Object.entries(carrierTotals)
    .map(([carrier, data]) => {
      const avgDbm = Math.round(data.sum / data.count);
      return {
        carrier,
        avgDbm,
        activityLevel: getActivityLevel(avgDbm),
        sampleCount: data.samples,
      };
    })
    .sort((a, b) => b.avgDbm - a.avgDbm);

  const totalDataPoints = ranking.reduce((s, r) => s + r.sampleCount, 0);

  return { ranking, segments, totalDataPoints };
}

async function compareLocation(lng, lat, radiusMeters, days) {
  const radiusDeg = radiusMeters / 111000;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const results = await SignalHistory.aggregate([
    {
      $match: {
        swLng: { $lte: lng + radiusDeg },
        neLng: { $gte: lng - radiusDeg },
        swLat: { $lte: lat + radiusDeg },
        neLat: { $gte: lat - radiusDeg },
        hour: { $gte: since },
      },
    },
    {
      $group: {
        _id: '$carrier',
        avgDbm: { $avg: '$avgDbm' },
        sampleCount: { $sum: '$sampleCount' },
      },
    },
    { $sort: { avgDbm: -1 } },
  ]);

  return results.map((r) => {
    const avgDbm = Math.round(r.avgDbm);
    return {
      carrier: r._id,
      avgDbm,
      activityLevel: getActivityLevel(avgDbm),
      sampleCount: r.sampleCount,
    };
  });
}

module.exports = { compareRoute, compareLocation };
```

- [ ] **Step 2: Create compare router**

```javascript
// server/routes/compare.js
const express = require('express');
const router = express.Router();
const compareService = require('../services/compare-service');

router.get('/route/:routeId', async (req, res) => {
  try {
    const result = await compareService.compareRoute(req.params.routeId);
    res.json(result);
  } catch (err) {
    res.status(err.message === 'Route not found' ? 404 : 500).json({ error: err.message });
  }
});

router.get('/location', async (req, res) => {
  try {
    const lng = parseFloat(req.query.lng);
    const lat = parseFloat(req.query.lat);
    const radius = parseInt(req.query.radius) || 500;
    const days = parseInt(req.query.days) || 7;

    if (isNaN(lng) || isNaN(lat)) {
      return res.status(400).json({ error: 'lng and lat are required' });
    }

    const data = await compareService.compareLocation(lng, lat, radius, days);
    res.json({ data, count: data.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 3: Register in app.js**

Add to `server/app.js` after existing router imports:
```javascript
const compareRouter = require('./routes/compare');
```

Add after existing `app.use` lines:
```javascript
app.use('/api/compare', compareRouter);
```

- [ ] **Step 4: Test endpoints**

```bash
curl -s http://localhost:3000/api/compare/location?lng=121.09&lat=14.69&radius=500&days=7
curl -s http://localhost:3000/api/compare/route/<ROUTE_ID>
```

- [ ] **Step 5: Commit**

```bash
git add server/services/compare-service.js server/routes/compare.js server/app.js
git commit -m "feat(api): add carrier comparison service and routes"
```

---

## Task 2: Mobile — API Client + Comparison Hook

**Files:**
- Modify: `src/lib/api/client.ts`
- Create: `src/features/comparison/hooks/use-comparison.ts`

- [ ] **Step 1: Add compare methods to API client**

Add inside the `export const api = {` object in `src/lib/api/client.ts`:

```typescript
  compare: {
    route(routeId: string): Promise<{
      ranking: { carrier: string; avgDbm: number; activityLevel: string; sampleCount: number }[];
      segments: { label: string; distanceMeters: number; carriers: { carrier: string; avgDbm: number; activityLevel: string }[] }[];
      totalDataPoints: number;
    }> {
      return request(`/compare/route/${routeId}`);
    },

    location(lng: number, lat: number, radius = 500, days = 7): Promise<{
      data: { carrier: string; avgDbm: number; activityLevel: string; sampleCount: number }[];
      count: number;
    }> {
      return request(`/compare/location?lng=${lng}&lat=${lat}&radius=${radius}&days=${days}`);
    },
  },
```

- [ ] **Step 2: Create use-comparison hook**

```typescript
// src/features/comparison/hooks/use-comparison.ts
import { useState, useCallback } from 'react';
import { api } from '../../../lib/api/client';

interface CarrierRanking {
  carrier: string;
  avgDbm: number;
  activityLevel: string;
  sampleCount: number;
}

interface SegmentComparison {
  label: string;
  distanceMeters: number;
  carriers: { carrier: string; avgDbm: number; activityLevel: string }[];
}

interface RouteComparisonData {
  ranking: CarrierRanking[];
  segments: SegmentComparison[];
  totalDataPoints: number;
}

export function useComparison() {
  const [routeData, setRouteData] = useState<RouteComparisonData | null>(null);
  const [locationData, setLocationData] = useState<CarrierRanking[]>([]);
  const [loading, setLoading] = useState(false);

  const compareRoute = useCallback(async (routeId: string) => {
    setLoading(true);
    try {
      const result = await api.compare.route(routeId);
      setRouteData(result);
      return result;
    } catch (err) {
      console.warn('Route comparison failed:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const compareLocation = useCallback(async (lng: number, lat: number) => {
    setLoading(true);
    try {
      const result = await api.compare.location(lng, lat);
      setLocationData(result.data);
      return result.data;
    } catch (err) {
      console.warn('Location comparison failed:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return { routeData, locationData, loading, compareRoute, compareLocation };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/api/client.ts src/features/comparison/hooks/use-comparison.ts
git commit -m "feat(mobile): add comparison API client + hook"
```

---

## Task 3: Mobile — RouteComparison Screen

**Files:**
- Create: `src/features/comparison/components/RouteComparison.tsx`
- Modify: `src/features/routes/components/RouteDetail.tsx`

- [ ] **Step 1: Create RouteComparison component**

Full-screen view showing carrier ranking cards at top, expandable segment breakdown table below. Uses the approved mockup design: #1 featured card, runner-ups as smaller cards, segment table with activity badges per carrier.

The component accepts a `routeId`, calls `useComparison().compareRoute(routeId)`, and renders the ranking + segments.

Activity badge colors: gaming=#22C55E, streaming=#84CC16, browsing=#EAB308, messaging=#F97316, dead=#EF4444. Carrier dots use `getCarrierColor()` from config.

Segment rows with all carriers dead/weak get a red-tinted background.

- [ ] **Step 2: Add "Compare Carriers" button to RouteDetail**

In `RouteDetail.tsx`, add a button below the route header that navigates to the RouteComparison overlay. Uses `onTouchEnd` (not TouchableOpacity) for Fabric compatibility.

- [ ] **Step 3: Commit**

```bash
git add src/features/comparison/components/RouteComparison.tsx src/features/routes/components/RouteDetail.tsx
git commit -m "feat(mobile): add RouteComparison screen with ranking + segments"
```

---

## Task 4: Mobile — LocationComparison Popup

**Files:**
- Create: `src/features/comparison/components/LocationComparison.tsx`

- [ ] **Step 1: Create LocationComparison component**

A modal/popup that shows carrier rankings for a given `[lng, lat]` coordinate. UI matches the approved mockup: title "Signal Here", subtitle with radius/days, list of carriers ranked by avgDbm with carrier color dots, activity badges, and dBm values.

Props: `visible: boolean`, `coordinates: [number, number] | null`, `onClose: () => void`.

Calls `useComparison().compareLocation(lng, lat)` when visible + coordinates change.

Shows "No data for this area" when no carriers returned. Shows loading spinner while fetching.

- [ ] **Step 2: Commit**

```bash
git add src/features/comparison/components/LocationComparison.tsx
git commit -m "feat(mobile): add LocationComparison popup"
```

---

## Task 5: Mobile — SearchBar with Nominatim

**Files:**
- Create: `src/features/comparison/components/SearchBar.tsx`

- [ ] **Step 1: Create SearchBar component**

A text input at the top of the map screen. On text change (debounced 1 second), queries Nominatim:

```
GET https://nominatim.openstreetmap.org/search?q=<query>&format=json&countrycodes=ph&limit=5
```

Headers: `User-Agent: Signalog/1.0` (Nominatim requires this).

Shows autocomplete dropdown with results. On select: calls `onSelectLocation({ lng, lat, name })` callback. Parent centers map and opens LocationComparison popup.

Props: `onSelectLocation: (loc: { lng: number; lat: number; name: string }) => void`.

Styled to match the filter chips area — positioned absolute, dark glass background, same font/color system.

- [ ] **Step 2: Commit**

```bash
git add src/features/comparison/components/SearchBar.tsx
git commit -m "feat(mobile): add SearchBar with Nominatim geocoding"
```

---

## Task 6: Mobile — Wire Everything into MapScreen

**Files:**
- Modify: `src/features/map-view/components/MapScreen.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { LocationComparison } from '../../comparison/components/LocationComparison';
import { SearchBar } from '../../comparison/components/SearchBar';
```

- [ ] **Step 2: Add state for comparison**

```typescript
const [compareVisible, setCompareVisible] = useState(false);
const [compareCoords, setCompareCoords] = useState<[number, number] | null>(null);
```

- [ ] **Step 3: Add "Compare Here" button in Live tab**

Below the Start Mapping CTA, add a "Compare Carriers Here" button:

```typescript
<View
  style={styles.compareBtn}
  onTouchEnd={async () => {
    try {
      const loc = await getCurrentLocation();
      setCompareCoords(loc.coordinates);
      setCompareVisible(true);
    } catch {}
  }}
>
  <Text style={styles.compareBtnText}>📊 Compare Carriers Here</Text>
</View>
```

- [ ] **Step 4: Add tap-on-map handler**

In the Leaflet HTML, add a map click listener that sends coordinates to React Native:

```javascript
map.on('click', function(e) {
  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'mapTap',
    lng: e.latlng.lng,
    lat: e.latlng.lat,
  }));
});
```

In `handleWebViewMessage`, add handling for `mapTap`:

```typescript
if (data.type === 'mapTap') {
  setCompareCoords([data.lng, data.lat]);
  setCompareVisible(true);
}
```

- [ ] **Step 5: Add SearchBar above filter chips**

```typescript
<SearchBar
  onSelectLocation={(loc) => {
    webViewRef.current?.injectJavaScript(
      `map.setView([${loc.lat},${loc.lng}], 15); true;`,
    );
    setCompareCoords([loc.lng, loc.lat]);
    setCompareVisible(true);
  }}
/>
```

- [ ] **Step 6: Add LocationComparison modal**

```typescript
<LocationComparison
  visible={compareVisible}
  coordinates={compareCoords}
  onClose={() => {
    setCompareVisible(false);
    setCompareCoords(null);
  }}
/>
```

- [ ] **Step 7: Add styles for compare button**

```typescript
compareBtn: {
  backgroundColor: '#1F2937',
  borderWidth: 1,
  borderColor: '#374151',
  borderRadius: 12,
  paddingVertical: 12,
  alignItems: 'center',
  marginTop: 8,
},
compareBtnText: {
  color: '#F9FAFB',
  fontSize: 13,
  fontWeight: '500',
},
```

- [ ] **Step 8: Commit**

```bash
git add src/features/map-view/components/MapScreen.tsx
git commit -m "feat(mobile): wire comparison into MapScreen — Compare Here, tap-on-map, SearchBar"
```

---

## Task 7: Build + Test on Device

- [ ] **Step 1: Sync all files to build directory**

Copy all new/modified files from repo to `C:\dev\signalog\`.

- [ ] **Step 2: Bundle and install**

```bash
cd /c/dev/signalog
npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res
cd android && ./gradlew.bat app:installDebug
```

- [ ] **Step 3: Test flows**

1. Open route → tap "Compare Carriers" → verify ranking + segments
2. Live tab → tap "Compare Carriers Here" → verify location popup
3. Tap on map → verify comparison popup
4. Search bar → type "Makati" → select → verify map centers + popup

- [ ] **Step 4: Push**

```bash
git push
```
