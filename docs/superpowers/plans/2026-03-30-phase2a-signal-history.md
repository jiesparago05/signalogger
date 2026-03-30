# Phase 2a: Signal History, Sessions & Commute Routes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add mapping sessions, personal timeline with map trails, saved commute routes with activity labels, location-based signal history, and work spot discovery for Filipino commuters and remote workers.

**Architecture:** Sessions wrap existing signal logs by time range + deviceId. Commute routes aggregate multiple sessions into segments. The heatmap worker is extended to compute hourly SignalHistory tiles and detect WorkZones. Mobile app adds session management, trail rendering, and route/work-spot UIs.

**Tech Stack:** MongoDB (Mongoose), Express, React Native, Leaflet (WebView), AsyncStorage, react-native-svg (charts)

---

## File Structure

### Backend (server/)

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `server/models/mapping-session.js` | MappingSession mongoose schema |
| Create | `server/models/commute-route.js` | CommuteRoute mongoose schema |
| Create | `server/models/signal-history.js` | SignalHistory mongoose schema |
| Create | `server/models/work-zone.js` | WorkZone mongoose schema |
| Create | `server/models/work-spot-review.js` | WorkSpotReview mongoose schema |
| Create | `server/services/session-service.js` | Session CRUD + stats computation |
| Create | `server/services/route-service.js` | Route CRUD + segment computation |
| Create | `server/services/history-service.js` | Location history queries |
| Create | `server/services/workzone-service.js` | Work zone queries + review CRUD |
| Create | `server/routes/sessions.js` | Session API endpoints |
| Create | `server/routes/routes.js` | Commute route API endpoints |
| Create | `server/routes/history.js` | Location history API endpoint |
| Create | `server/routes/workzones.js` | Work zones + reviews API endpoints |
| Modify | `server/app.js` | Register new routers |
| Modify | `server/workers/heatmap-aggregator.js` | Add SignalHistory + WorkZone computation |

### Mobile App (src/)

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/features/sessions/hooks/use-session.ts` | Session lifecycle (create/complete) |
| Create | `src/features/sessions/components/SessionsList.tsx` | Sessions tab with session cards |
| Create | `src/features/sessions/components/SessionDetail.tsx` | Map trail + chart + stats |
| Create | `src/features/sessions/components/SignalChart.tsx` | SVG line chart of dBm over time |
| Create | `src/features/routes/hooks/use-routes.ts` | Route CRUD + segment data |
| Create | `src/features/routes/components/RoutesList.tsx` | Saved routes list |
| Create | `src/features/routes/components/RouteDetail.tsx` | Route segments with activity labels |
| Create | `src/features/workspots/hooks/use-workspots.ts` | Work zone queries + reviews |
| Create | `src/features/workspots/components/WorkSpotsList.tsx` | Nearby work spots list |
| Create | `src/features/workspots/components/ReviewModal.tsx` | Carrier review submission |
| Create | `src/lib/utils/activity-levels.ts` | dBm → activity level mapping |
| Modify | `src/features/map-view/components/MapScreen.tsx` | Add session tabs, trail rendering, work zone overlay, tap-to-query |
| Modify | `src/features/offline-sync/services/log-store.ts` | Add session + review storage |
| Modify | `src/features/offline-sync/services/sync-service.ts` | Sync sessions + reviews |
| Modify | `src/lib/api/client.ts` | Add session/route/history/workzone API methods |
| Modify | `src/types/signal.ts` | Add new type definitions |

---

## Task 1: Activity Level Utility

**Files:**
- Create: `src/lib/utils/activity-levels.ts`

- [ ] **Step 1: Create activity level mapping**

```typescript
// src/lib/utils/activity-levels.ts

export type ActivityLevel = 'gaming' | 'streaming' | 'browsing' | 'messaging' | 'dead';

export interface ActivityInfo {
  level: ActivityLevel;
  label: string;
  color: string;
}

const ACTIVITY_THRESHOLDS: { min: number; info: ActivityInfo }[] = [
  { min: -75, info: { level: 'gaming', label: 'Gaming + Streaming + Browse', color: '#22C55E' } },
  { min: -85, info: { level: 'streaming', label: 'Streaming + Browse', color: '#84CC16' } },
  { min: -95, info: { level: 'browsing', label: 'Browse + Messaging', color: '#EAB308' } },
  { min: -105, info: { level: 'messaging', label: 'Messaging Only (slow)', color: '#F97316' } },
];

const DEAD_ACTIVITY: ActivityInfo = { level: 'dead', label: 'No Data — Dead Zone', color: '#EF4444' };

export function getActivityLevel(avgDbm: number): ActivityInfo {
  for (const threshold of ACTIVITY_THRESHOLDS) {
    if (avgDbm >= threshold.min) return threshold.info;
  }
  return DEAD_ACTIVITY;
}

export function getRouteGrade(segments: { avgDbm: number }[]): string {
  if (segments.length === 0) return 'N/A';
  const avg = segments.reduce((sum, s) => sum + s.avgDbm, 0) / segments.length;
  if (avg >= -70) return 'A';
  if (avg >= -80) return 'B';
  if (avg >= -90) return 'C';
  if (avg >= -100) return 'D';
  return 'F';
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/utils/activity-levels.ts
git commit -m "feat: add activity level utility (dBm → gaming/streaming/browsing/messaging/dead)"
```

---

## Task 2: Type Definitions

**Files:**
- Modify: `src/types/signal.ts`

- [ ] **Step 1: Add new types to signal.ts**

Append to the end of `src/types/signal.ts`:

```typescript
export interface MappingSession {
  _id?: string;
  deviceId: string;
  startTime: Date | string;
  endTime?: Date | string;
  startLocation?: { type: 'Point'; coordinates: [number, number] };
  endLocation?: { type: 'Point'; coordinates: [number, number] };
  logCount: number;
  avgDbm: number;
  minDbm: number;
  maxDbm: number;
  carrier: string;
  networkType: NetworkType;
  distanceMeters: number;
  stability: 'Stable' | 'Fluctuating' | 'Unstable';
  routeId?: string;
  status: 'active' | 'completed';
  synced: boolean;
}

export interface RouteSegment {
  startLocation: { type: 'Point'; coordinates: [number, number] };
  endLocation: { type: 'Point'; coordinates: [number, number] };
  label: string;
  distanceMeters: number;
  avgDbm: number;
  minDbm: number;
  maxDbm: number;
  sampleCount: number;
  activityLevel: string;
}

export interface CommuteRoute {
  _id?: string;
  deviceId: string;
  name: string;
  sessions: string[];
  segments: RouteSegment[];
  overallGrade: string;
  totalTrips: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface SignalHistoryEntry {
  carrier: string;
  avgDbm: number;
  sampleCount: number;
}

export interface WorkZone {
  _id?: string;
  gridCell: { sw: [number, number]; ne: [number, number] };
  carriers: { carrier: string; avgDbm: number; sampleCount: number; activityLevel: string }[];
  bestCarrier: string;
  bestAvgDbm: number;
}

export interface WorkSpotReview {
  _id?: string;
  location: { type: 'Point'; coordinates: [number, number] };
  deviceId: string;
  carrier: string;
  rating: 'strong' | 'ok' | 'weak' | 'dead';
  comment: string;
  timestamp: Date | string;
  synced: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/signal.ts
git commit -m "feat: add Phase 2a type definitions (sessions, routes, work zones, reviews)"
```

---

## Task 3: Backend — MappingSession Model + Service + Routes

**Files:**
- Create: `server/models/mapping-session.js`
- Create: `server/services/session-service.js`
- Create: `server/routes/sessions.js`
- Modify: `server/app.js`

- [ ] **Step 1: Create MappingSession model**

```javascript
// server/models/mapping-session.js
const mongoose = require('mongoose');

const mappingSessionSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, index: true },
  startTime: { type: Date, required: true },
  endTime: Date,
  startLocation: {
    type: { type: String, enum: ['Point'] },
    coordinates: [Number],
  },
  endLocation: {
    type: { type: String, enum: ['Point'] },
    coordinates: [Number],
  },
  logCount: { type: Number, default: 0 },
  avgDbm: Number,
  minDbm: Number,
  maxDbm: Number,
  carrier: String,
  networkType: String,
  distanceMeters: { type: Number, default: 0 },
  stability: { type: String, enum: ['Stable', 'Fluctuating', 'Unstable'] },
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommuteRoute' },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  synced: { type: Boolean, default: false },
});

mappingSessionSchema.index({ deviceId: 1, startTime: -1 });

module.exports = mongoose.model('MappingSession', mappingSessionSchema);
```

- [ ] **Step 2: Create session service**

```javascript
// server/services/session-service.js
const MappingSession = require('../models/mapping-session');
const SignalLog = require('../models/signal-log');

async function create(data) {
  return MappingSession.create(data);
}

async function complete(sessionId, stats) {
  return MappingSession.findByIdAndUpdate(
    sessionId,
    { ...stats, status: 'completed' },
    { new: true },
  );
}

async function listByDevice(deviceId, limit = 20, skip = 0) {
  return MappingSession.find({ deviceId, status: 'completed' })
    .sort({ startTime: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
}

async function getTrail(sessionId) {
  const session = await MappingSession.findById(sessionId).lean();
  if (!session) throw new Error('Session not found');

  const query = {
    deviceId: session.deviceId,
    timestamp: { $gte: session.startTime },
  };
  if (session.endTime) {
    query.timestamp.$lte = session.endTime;
  }

  return SignalLog.find(query)
    .sort({ timestamp: 1 })
    .select('timestamp location signal.dbm carrier networkType')
    .lean();
}

module.exports = { create, complete, listByDevice, getTrail };
```

- [ ] **Step 3: Create sessions router**

```javascript
// server/routes/sessions.js
const express = require('express');
const router = express.Router();
const sessionService = require('../services/session-service');

// Create session
router.post('/', async (req, res) => {
  try {
    const session = await sessionService.create(req.body);
    res.status(201).json(session);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Complete session
router.patch('/:id', async (req, res) => {
  try {
    const session = await sessionService.complete(req.params.id, req.body);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List sessions for device
router.get('/device/:deviceId', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const skip = parseInt(req.query.skip) || 0;
    const sessions = await sessionService.listByDevice(req.params.deviceId, limit, skip);
    res.json({ data: sessions, count: sessions.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get trail for session
router.get('/:id/trail', async (req, res) => {
  try {
    const trail = await sessionService.getTrail(req.params.id);
    res.json({ data: trail, count: trail.length });
  } catch (err) {
    res.status(err.message === 'Session not found' ? 404 : 500).json({ error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 4: Register sessions router in app.js**

Add to `server/app.js` after existing router imports:

```javascript
const sessionsRouter = require('./routes/sessions');
```

Add after existing `app.use` lines:

```javascript
app.use('/api/sessions', sessionsRouter);
```

- [ ] **Step 5: Test manually**

```bash
# Start server
cd server && node index.js

# Create session
curl -s -X POST http://localhost:3000/api/sessions -H "Content-Type: application/json" -d '{"deviceId":"test","startTime":"2026-03-30T12:00:00Z","carrier":"GOMO","networkType":"4G"}'

# Complete session
curl -s -X PATCH http://localhost:3000/api/sessions/<ID_FROM_ABOVE> -H "Content-Type: application/json" -d '{"endTime":"2026-03-30T12:30:00Z","logCount":42,"avgDbm":-85,"minDbm":-100,"maxDbm":-70,"distanceMeters":1200,"stability":"Fluctuating"}'

# List sessions
curl -s http://localhost:3000/api/sessions/device/test
```

- [ ] **Step 6: Commit**

```bash
git add server/models/mapping-session.js server/services/session-service.js server/routes/sessions.js server/app.js
git commit -m "feat(api): add MappingSession model, service, and routes"
```

---

## Task 4: Backend — CommuteRoute Model + Service + Routes

**Files:**
- Create: `server/models/commute-route.js`
- Create: `server/services/route-service.js`
- Create: `server/routes/routes.js`
- Modify: `server/app.js`

- [ ] **Step 1: Create CommuteRoute model**

```javascript
// server/models/commute-route.js
const mongoose = require('mongoose');

const segmentSchema = new mongoose.Schema({
  startLocation: {
    type: { type: String, enum: ['Point'] },
    coordinates: [Number],
  },
  endLocation: {
    type: { type: String, enum: ['Point'] },
    coordinates: [Number],
  },
  label: String,
  distanceMeters: Number,
  avgDbm: Number,
  minDbm: Number,
  maxDbm: Number,
  sampleCount: Number,
  activityLevel: String,
}, { _id: false });

const commuteRouteSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  sessions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MappingSession' }],
  segments: [segmentSchema],
  overallGrade: String,
  totalTrips: { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('CommuteRoute', commuteRouteSchema);
```

- [ ] **Step 2: Create route service**

```javascript
// server/services/route-service.js
const CommuteRoute = require('../models/commute-route');
const SignalLog = require('../models/signal-log');
const MappingSession = require('../models/mapping-session');

function distanceBetween(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getActivityLevel(avgDbm) {
  if (avgDbm >= -75) return 'gaming';
  if (avgDbm >= -85) return 'streaming';
  if (avgDbm >= -95) return 'browsing';
  if (avgDbm >= -105) return 'messaging';
  return 'dead';
}

function getGrade(segments) {
  if (segments.length === 0) return 'N/A';
  const avg = segments.reduce((s, seg) => s + seg.avgDbm, 0) / segments.length;
  if (avg >= -70) return 'A';
  if (avg >= -80) return 'B';
  if (avg >= -90) return 'C';
  if (avg >= -100) return 'D';
  return 'F';
}

async function computeSegments(sessionIds) {
  const sessions = await MappingSession.find({ _id: { $in: sessionIds } }).lean();
  if (sessions.length === 0) return [];

  // Get all logs for these sessions
  const allLogs = [];
  for (const session of sessions) {
    const query = {
      deviceId: session.deviceId,
      timestamp: { $gte: session.startTime },
    };
    if (session.endTime) query.timestamp.$lte = session.endTime;
    const logs = await SignalLog.find(query).sort({ timestamp: 1 }).lean();
    allLogs.push(...logs);
  }

  if (allLogs.length === 0) return [];

  // Sort by timestamp
  allLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Divide into ~1km segments
  const segments = [];
  let segStart = 0;
  let segDistance = 0;
  let segIndex = 0;

  for (let i = 1; i < allLogs.length; i++) {
    const prev = allLogs[i - 1];
    const curr = allLogs[i];
    const d = distanceBetween(
      prev.location.coordinates[1], prev.location.coordinates[0],
      curr.location.coordinates[1], curr.location.coordinates[0],
    );
    segDistance += d;

    if (segDistance >= 1000 || i === allLogs.length - 1) {
      const segLogs = allLogs.slice(segStart, i + 1);
      const dbms = segLogs.map(l => l.signal.dbm);
      const avgDbm = Math.round(dbms.reduce((s, v) => s + v, 0) / dbms.length);

      segments.push({
        startLocation: {
          type: 'Point',
          coordinates: allLogs[segStart].location.coordinates,
        },
        endLocation: {
          type: 'Point',
          coordinates: curr.location.coordinates,
        },
        label: `KM ${segIndex}-${segIndex + 1}`,
        distanceMeters: Math.round(segDistance),
        avgDbm,
        minDbm: Math.min(...dbms),
        maxDbm: Math.max(...dbms),
        sampleCount: segLogs.length,
        activityLevel: getActivityLevel(avgDbm),
      });

      segStart = i;
      segDistance = 0;
      segIndex++;
    }
  }

  return segments;
}

async function create(data) {
  const segments = await computeSegments(data.sessions || []);
  const route = await CommuteRoute.create({
    ...data,
    segments,
    overallGrade: getGrade(segments),
    totalTrips: 1,
  });
  // Link session to route
  if (data.sessions && data.sessions.length > 0) {
    await MappingSession.updateMany(
      { _id: { $in: data.sessions } },
      { routeId: route._id },
    );
  }
  return route;
}

async function addSession(routeId, sessionId) {
  const route = await CommuteRoute.findById(routeId);
  if (!route) throw new Error('Route not found');

  route.sessions.push(sessionId);
  route.totalTrips = route.sessions.length;

  const segments = await computeSegments(route.sessions);
  route.segments = segments;
  route.overallGrade = getGrade(segments);
  route.updatedAt = new Date();

  await route.save();
  await MappingSession.findByIdAndUpdate(sessionId, { routeId });
  return route;
}

async function listByDevice(deviceId) {
  return CommuteRoute.find({ deviceId }).sort({ updatedAt: -1 }).lean();
}

async function getById(routeId) {
  return CommuteRoute.findById(routeId).lean();
}

module.exports = { create, addSession, listByDevice, getById };
```

- [ ] **Step 3: Create routes router**

```javascript
// server/routes/routes.js
const express = require('express');
const router = express.Router();
const routeService = require('../services/route-service');

router.post('/', async (req, res) => {
  try {
    const route = await routeService.create(req.body);
    res.status(201).json(route);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id/add-session', async (req, res) => {
  try {
    const route = await routeService.addSession(req.params.id, req.body.sessionId);
    res.json(route);
  } catch (err) {
    res.status(err.message === 'Route not found' ? 404 : 400).json({ error: err.message });
  }
});

router.get('/device/:deviceId', async (req, res) => {
  try {
    const routes = await routeService.listByDevice(req.params.deviceId);
    res.json({ data: routes, count: routes.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const route = await routeService.getById(req.params.id);
    if (!route) return res.status(404).json({ error: 'Route not found' });
    res.json(route);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 4: Register routes router in app.js**

Add to `server/app.js`:

```javascript
const routesRouter = require('./routes/routes');
```

```javascript
app.use('/api/routes', routesRouter);
```

- [ ] **Step 5: Commit**

```bash
git add server/models/commute-route.js server/services/route-service.js server/routes/routes.js server/app.js
git commit -m "feat(api): add CommuteRoute model, service, and routes with segment computation"
```

---

## Task 5: Backend — SignalHistory + WorkZone Models + Extended Worker

**Files:**
- Create: `server/models/signal-history.js`
- Create: `server/models/work-zone.js`
- Create: `server/models/work-spot-review.js`
- Create: `server/services/history-service.js`
- Create: `server/services/workzone-service.js`
- Create: `server/routes/history.js`
- Create: `server/routes/workzones.js`
- Modify: `server/workers/heatmap-aggregator.js`
- Modify: `server/app.js`

- [ ] **Step 1: Create SignalHistory model**

```javascript
// server/models/signal-history.js
const mongoose = require('mongoose');

const signalHistorySchema = new mongoose.Schema({
  swLng: { type: Number, required: true },
  swLat: { type: Number, required: true },
  neLng: { type: Number, required: true },
  neLat: { type: Number, required: true },
  carrier: { type: String, required: true },
  networkType: { type: String, required: true },
  hour: { type: Date, required: true },
  avgDbm: Number,
  minDbm: Number,
  maxDbm: Number,
  sampleCount: Number,
});

signalHistorySchema.index(
  { swLng: 1, swLat: 1, neLng: 1, neLat: 1, carrier: 1, networkType: 1, hour: 1 },
  { unique: true },
);

module.exports = mongoose.model('SignalHistory', signalHistorySchema);
```

- [ ] **Step 2: Create WorkZone model**

```javascript
// server/models/work-zone.js
const mongoose = require('mongoose');

const workZoneSchema = new mongoose.Schema({
  swLng: { type: Number, required: true },
  swLat: { type: Number, required: true },
  neLng: { type: Number, required: true },
  neLat: { type: Number, required: true },
  carriers: [{
    carrier: String,
    avgDbm: Number,
    sampleCount: Number,
    activityLevel: String,
  }],
  bestCarrier: String,
  bestAvgDbm: Number,
  lastUpdated: { type: Date, default: Date.now },
});

workZoneSchema.index({ swLng: 1, swLat: 1, neLng: 1, neLat: 1 }, { unique: true });

module.exports = mongoose.model('WorkZone', workZoneSchema);
```

- [ ] **Step 3: Create WorkSpotReview model**

```javascript
// server/models/work-spot-review.js
const mongoose = require('mongoose');

const workSpotReviewSchema = new mongoose.Schema({
  location: {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true },
  },
  deviceId: { type: String, required: true },
  carrier: { type: String, required: true },
  rating: { type: String, enum: ['strong', 'ok', 'weak', 'dead'], required: true },
  comment: { type: String, maxlength: 200 },
  timestamp: { type: Date, default: Date.now },
  synced: { type: Boolean, default: false },
});

workSpotReviewSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('WorkSpotReview', workSpotReviewSchema);
```

- [ ] **Step 4: Create history service**

```javascript
// server/services/history-service.js
const SignalHistory = require('../models/signal-history');

async function queryByLocation(lng, lat, radiusMeters, days, carrier) {
  const radiusDeg = radiusMeters / 111000;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const query = {
    swLng: { $lte: lng + radiusDeg },
    neLng: { $gte: lng - radiusDeg },
    swLat: { $lte: lat + radiusDeg },
    neLat: { $gte: lat - radiusDeg },
    hour: { $gte: since },
  };

  if (carrier) query.carrier = carrier;

  const results = await SignalHistory.aggregate([
    { $match: query },
    {
      $group: {
        _id: { carrier: '$carrier' },
        avgDbm: { $avg: '$avgDbm' },
        sampleCount: { $sum: '$sampleCount' },
      },
    },
    { $sort: { avgDbm: -1 } },
  ]);

  return results.map((r) => ({
    carrier: r._id.carrier,
    avgDbm: Math.round(r.avgDbm),
    sampleCount: r.sampleCount,
  }));
}

module.exports = { queryByLocation };
```

- [ ] **Step 5: Create workzone service**

```javascript
// server/services/workzone-service.js
const WorkZone = require('../models/work-zone');
const WorkSpotReview = require('../models/work-spot-review');

async function queryByBounds(bounds) {
  return WorkZone.find({
    swLng: { $gte: bounds.sw[0] },
    swLat: { $gte: bounds.sw[1] },
    neLng: { $lte: bounds.ne[0] },
    neLat: { $lte: bounds.ne[1] },
    bestAvgDbm: { $gte: -75 },
  }).lean();
}

async function queryNearby(lng, lat, radiusMeters) {
  const radiusDeg = radiusMeters / 111000;
  return WorkZone.find({
    swLng: { $lte: lng + radiusDeg },
    neLng: { $gte: lng - radiusDeg },
    swLat: { $lte: lat + radiusDeg },
    neLat: { $gte: lat - radiusDeg },
    bestAvgDbm: { $gte: -75 },
  })
    .sort({ bestAvgDbm: -1 })
    .limit(20)
    .lean();
}

async function createReview(data) {
  return WorkSpotReview.create(data);
}

async function queryReviews(bounds) {
  return WorkSpotReview.find({
    location: {
      $geoWithin: {
        $box: [bounds.sw, bounds.ne],
      },
    },
  })
    .sort({ timestamp: -1 })
    .limit(100)
    .lean();
}

module.exports = { queryByBounds, queryNearby, createReview, queryReviews };
```

- [ ] **Step 6: Create history router**

```javascript
// server/routes/history.js
const express = require('express');
const router = express.Router();
const historyService = require('../services/history-service');

router.get('/', async (req, res) => {
  try {
    const lng = parseFloat(req.query.lng);
    const lat = parseFloat(req.query.lat);
    const radius = parseInt(req.query.radius) || 500;
    const days = parseInt(req.query.days) || 7;
    const carrier = req.query.carrier || null;

    if (isNaN(lng) || isNaN(lat)) {
      return res.status(400).json({ error: 'lng and lat are required' });
    }

    const data = await historyService.queryByLocation(lng, lat, radius, days, carrier);
    res.json({ data, count: data.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 7: Create workzones router**

```javascript
// server/routes/workzones.js
const express = require('express');
const router = express.Router();
const { validateBounds, parseFilters } = require('../middleware/validate');
const workzoneService = require('../services/workzone-service');

router.get('/', validateBounds, async (req, res) => {
  try {
    const zones = await workzoneService.queryByBounds(req.bounds);
    res.json({ data: zones, count: zones.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/nearby', async (req, res) => {
  try {
    const lng = parseFloat(req.query.lng);
    const lat = parseFloat(req.query.lat);
    const radius = parseInt(req.query.radius) || 1000;

    if (isNaN(lng) || isNaN(lat)) {
      return res.status(400).json({ error: 'lng and lat are required' });
    }

    const zones = await workzoneService.queryNearby(lng, lat, radius);
    res.json({ data: zones, count: zones.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reviews', async (req, res) => {
  try {
    const review = await workzoneService.createReview(req.body);
    res.status(201).json(review);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/reviews', validateBounds, async (req, res) => {
  try {
    const reviews = await workzoneService.queryReviews(req.bounds);
    res.json({ data: reviews, count: reviews.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 8: Extend heatmap aggregator with SignalHistory + WorkZone computation**

Add to the end of the `aggregate()` function in `server/workers/heatmap-aggregator.js`, before the final console.log:

```javascript
  // --- Signal History (hourly averages) ---
  const SignalHistory = require('../models/signal-history');
  const historyTileSize = 0.01; // ~1km grid

  const historyPipeline = [
    {
      $group: {
        _id: {
          tileLng: {
            $multiply: [
              { $floor: { $divide: [{ $arrayElemAt: ['$location.coordinates', 0] }, historyTileSize] } },
              historyTileSize,
            ],
          },
          tileLat: {
            $multiply: [
              { $floor: { $divide: [{ $arrayElemAt: ['$location.coordinates', 1] }, historyTileSize] } },
              historyTileSize,
            ],
          },
          carrier: '$carrier',
          networkType: '$networkType',
          hour: {
            $dateTrunc: { date: '$timestamp', unit: 'hour' },
          },
        },
        avgDbm: { $avg: '$signal.dbm' },
        minDbm: { $min: '$signal.dbm' },
        maxDbm: { $max: '$signal.dbm' },
        count: { $sum: 1 },
      },
    },
  ];

  const historyResults = await SignalLog.aggregate(historyPipeline);

  for (const r of historyResults) {
    const swLng = parseFloat(r._id.tileLng.toFixed(6));
    const swLat = parseFloat(r._id.tileLat.toFixed(6));

    await SignalHistory.findOneAndUpdate(
      {
        swLng, swLat,
        neLng: parseFloat((r._id.tileLng + historyTileSize).toFixed(6)),
        neLat: parseFloat((r._id.tileLat + historyTileSize).toFixed(6)),
        carrier: r._id.carrier,
        networkType: r._id.networkType,
        hour: r._id.hour,
      },
      {
        avgDbm: Math.round(r.avgDbm),
        minDbm: r.minDbm,
        maxDbm: r.maxDbm,
        sampleCount: r.count,
      },
      { upsert: true },
    );
  }

  // --- Work Zones (areas with strong signal) ---
  const WorkZone = require('../models/work-zone');

  const workZonePipeline = [
    {
      $group: {
        _id: {
          tileLng: {
            $multiply: [
              { $floor: { $divide: [{ $arrayElemAt: ['$location.coordinates', 0] }, historyTileSize] } },
              historyTileSize,
            ],
          },
          tileLat: {
            $multiply: [
              { $floor: { $divide: [{ $arrayElemAt: ['$location.coordinates', 1] }, historyTileSize] } },
              historyTileSize,
            ],
          },
          carrier: '$carrier',
        },
        avgDbm: { $avg: '$signal.dbm' },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gte: 10 } } },
  ];

  const wzResults = await SignalLog.aggregate(workZonePipeline);

  // Group by grid cell
  const wzMap = {};
  for (const r of wzResults) {
    const key = `${r._id.tileLng}_${r._id.tileLat}`;
    if (!wzMap[key]) wzMap[key] = { tileLng: r._id.tileLng, tileLat: r._id.tileLat, carriers: [] };

    let activityLevel = 'dead';
    if (r.avgDbm >= -75) activityLevel = 'gaming';
    else if (r.avgDbm >= -85) activityLevel = 'streaming';
    else if (r.avgDbm >= -95) activityLevel = 'browsing';
    else if (r.avgDbm >= -105) activityLevel = 'messaging';

    wzMap[key].carriers.push({
      carrier: r._id.carrier,
      avgDbm: Math.round(r.avgDbm),
      sampleCount: r.count,
      activityLevel,
    });
  }

  for (const wz of Object.values(wzMap)) {
    const best = wz.carriers.reduce((a, b) => a.avgDbm > b.avgDbm ? a : b);
    const swLng = parseFloat(wz.tileLng.toFixed(6));
    const swLat = parseFloat(wz.tileLat.toFixed(6));

    await WorkZone.findOneAndUpdate(
      {
        swLng, swLat,
        neLng: parseFloat((wz.tileLng + historyTileSize).toFixed(6)),
        neLat: parseFloat((wz.tileLat + historyTileSize).toFixed(6)),
      },
      {
        carriers: wz.carriers,
        bestCarrier: best.carrier,
        bestAvgDbm: best.avgDbm,
        lastUpdated: new Date(),
      },
      { upsert: true },
    );
  }
```

- [ ] **Step 9: Register history + workzones routers in app.js**

Add to `server/app.js`:

```javascript
const historyRouter = require('./routes/history');
const workzonesRouter = require('./routes/workzones');
```

```javascript
app.use('/api/history', historyRouter);
app.use('/api/workzones', workzonesRouter);
```

- [ ] **Step 10: Commit**

```bash
git add server/models/signal-history.js server/models/work-zone.js server/models/work-spot-review.js server/services/history-service.js server/services/workzone-service.js server/routes/history.js server/routes/workzones.js server/workers/heatmap-aggregator.js server/app.js
git commit -m "feat(api): add SignalHistory, WorkZone, reviews — extend aggregator worker"
```

---

## Task 6: Mobile — API Client Extensions

**Files:**
- Modify: `src/lib/api/client.ts`

- [ ] **Step 1: Add new API methods to client.ts**

Add inside the `export const api = {` object, after the existing `export` section:

```typescript
  sessions: {
    create(data: Partial<MappingSession>): Promise<MappingSession> {
      return request('/sessions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    complete(sessionId: string, stats: Partial<MappingSession>): Promise<MappingSession> {
      return request(`/sessions/${sessionId}`, {
        method: 'PATCH',
        body: JSON.stringify(stats),
      });
    },

    listByDevice(deviceId: string, limit = 20): Promise<{ data: MappingSession[]; count: number }> {
      return request(`/sessions/device/${deviceId}?limit=${limit}`);
    },

    getTrail(sessionId: string): Promise<{ data: SignalLog[]; count: number }> {
      return request(`/sessions/${sessionId}/trail`);
    },
  },

  routes: {
    create(data: { deviceId: string; name: string; sessions: string[] }): Promise<CommuteRoute> {
      return request('/routes', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    addSession(routeId: string, sessionId: string): Promise<CommuteRoute> {
      return request(`/routes/${routeId}/add-session`, {
        method: 'PATCH',
        body: JSON.stringify({ sessionId }),
      });
    },

    listByDevice(deviceId: string): Promise<{ data: CommuteRoute[]; count: number }> {
      return request(`/routes/device/${deviceId}`);
    },

    getById(routeId: string): Promise<CommuteRoute> {
      return request(`/routes/${routeId}`);
    },
  },

  history: {
    query(lng: number, lat: number, radius = 500, days = 7, carrier?: string): Promise<{ data: SignalHistoryEntry[]; count: number }> {
      const params = new URLSearchParams({
        lng: String(lng),
        lat: String(lat),
        radius: String(radius),
        days: String(days),
      });
      if (carrier) params.set('carrier', carrier);
      return request(`/history?${params}`);
    },
  },

  workzones: {
    query(bounds: ViewportBounds): Promise<{ data: WorkZone[]; count: number }> {
      const params = new URLSearchParams({
        sw_lng: String(bounds.sw[0]),
        sw_lat: String(bounds.sw[1]),
        ne_lng: String(bounds.ne[0]),
        ne_lat: String(bounds.ne[1]),
      });
      return request(`/workzones?${params}`);
    },

    nearby(lng: number, lat: number, radius = 1000): Promise<{ data: WorkZone[]; count: number }> {
      return request(`/workzones/nearby?lng=${lng}&lat=${lat}&radius=${radius}`);
    },

    createReview(review: Omit<WorkSpotReview, '_id'>): Promise<WorkSpotReview> {
      return request('/workzones/reviews', {
        method: 'POST',
        body: JSON.stringify(review),
      });
    },
  },
```

Also add the new type imports at the top of the file:

```typescript
import { MappingSession, CommuteRoute, SignalHistoryEntry, WorkZone, WorkSpotReview } from '../../types/signal';
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/api/client.ts
git commit -m "feat(mobile): add API client methods for sessions, routes, history, workzones"
```

---

## Task 7: Mobile — Session Hook + Integration with MapScreen

**Files:**
- Create: `src/features/sessions/hooks/use-session.ts`
- Modify: `src/features/map-view/components/MapScreen.tsx`

- [ ] **Step 1: Create use-session hook**

```typescript
// src/features/sessions/hooks/use-session.ts
import { useState, useCallback, useRef } from 'react';
import { api } from '../../../lib/api/client';
import { getDeviceId } from '../../../lib/config/device';
import { getCurrentLocation } from '../../signal-logging/services/location-service';
import { MappingSession, SignalLog } from '../../../types/signal';

export function useSession() {
  const [activeSession, setActiveSession] = useState<MappingSession | null>(null);
  const logsRef = useRef<SignalLog[]>([]);

  const startSession = useCallback(async (carrier: string, networkType: string) => {
    try {
      const deviceId = await getDeviceId();
      let startLocation;
      try {
        const loc = await getCurrentLocation();
        startLocation = { type: 'Point' as const, coordinates: loc.coordinates };
      } catch {}

      const session: Partial<MappingSession> = {
        deviceId,
        startTime: new Date(),
        carrier,
        networkType,
        status: 'active',
        logCount: 0,
        avgDbm: 0,
        minDbm: 0,
        maxDbm: 0,
        distanceMeters: 0,
        stability: 'Stable',
        synced: false,
      };

      if (startLocation) session.startLocation = startLocation;

      // Try to create on server, fall back to local-only
      try {
        const created = await api.sessions.create(session);
        setActiveSession(created);
      } catch {
        const localSession = { ...session, _id: `local_${Date.now()}` } as MappingSession;
        setActiveSession(localSession);
      }

      logsRef.current = [];
    } catch (err) {
      console.warn('Failed to start session:', err);
    }
  }, []);

  const addLog = useCallback((log: SignalLog) => {
    logsRef.current.push(log);
  }, []);

  const completeSession = useCallback(async () => {
    if (!activeSession) return null;

    const logs = logsRef.current;
    const dbms = logs.map((l) => l.signal.dbm).filter((d) => d > -999);

    let endLocation;
    try {
      const loc = await getCurrentLocation();
      endLocation = { type: 'Point' as const, coordinates: loc.coordinates };
    } catch {}

    // Compute distance
    let totalDistance = 0;
    for (let i = 1; i < logs.length; i++) {
      const prev = logs[i - 1].location.coordinates;
      const curr = logs[i].location.coordinates;
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

    const avgDbm = dbms.length > 0 ? Math.round(dbms.reduce((s, v) => s + v, 0) / dbms.length) : 0;
    const minDbm = dbms.length > 0 ? Math.min(...dbms) : 0;
    const maxDbm = dbms.length > 0 ? Math.max(...dbms) : 0;
    const range = maxDbm - minDbm;
    const stability = range <= 10 ? 'Stable' : range <= 25 ? 'Fluctuating' : 'Unstable';

    const stats: Partial<MappingSession> = {
      endTime: new Date(),
      endLocation,
      logCount: logs.length,
      avgDbm,
      minDbm,
      maxDbm,
      distanceMeters: Math.round(totalDistance),
      stability: stability as MappingSession['stability'],
    };

    try {
      if (activeSession._id && !activeSession._id.startsWith('local_')) {
        await api.sessions.complete(activeSession._id, stats);
      }
    } catch {
      console.warn('Failed to complete session on server');
    }

    const completed = { ...activeSession, ...stats, status: 'completed' as const };
    setActiveSession(null);
    logsRef.current = [];
    return completed;
  }, [activeSession]);

  return {
    activeSession,
    startSession,
    addLog,
    completeSession,
  };
}
```

- [ ] **Step 2: Integrate session with MapScreen**

In `MapScreen.tsx`, import and use the session hook. Modify the `handleNewLog` and `handleToggle` callbacks:

Add import:
```typescript
import { useSession } from '../../sessions/hooks/use-session';
```

Add hook call after existing hooks:
```typescript
const { activeSession, startSession, addLog, completeSession } = useSession();
```

Update `handleNewLog`:
```typescript
const handleNewLog = useCallback((log: SignalLog) => {
  addLog(log);
}, [addLog]);
```

Update `handleToggle`:
```typescript
const handleToggle = useCallback(async () => {
  if (busyRef.current) return;
  busyRef.current = true;
  try {
    if (isActive) {
      await toggle();
      const completed = await completeSession();
      if (completed) {
        Alert.alert(
          'Session Complete',
          `${completed.logCount} logs · ${completed.distanceMeters}m · avg ${completed.avgDbm} dBm`,
          [
            { text: 'Dismiss' },
            { text: 'Save as Route', onPress: () => { /* TODO: Task 9 */ } },
          ],
        );
      }
    } else {
      const carrier = currentSignal?.carrier || 'Unknown';
      const networkType = currentSignal?.networkType || 'none';
      await startSession(carrier, networkType);
      await toggle();
      setTimeout(() => centerOnUser(), 1500);
    }
  } catch (err) {
    console.warn('handleToggle error:', err);
  } finally {
    setTimeout(() => { busyRef.current = false; }, 2000);
  }
}, [toggle, isActive, currentSignal, startSession, completeSession, centerOnUser]);
```

- [ ] **Step 3: Commit**

```bash
git add src/features/sessions/hooks/use-session.ts src/features/map-view/components/MapScreen.tsx
git commit -m "feat(mobile): add session hook, integrate with MapScreen start/stop"
```

---

## Task 8: Mobile — Sessions List + Session Detail UI

**Files:**
- Create: `src/features/sessions/components/SessionsList.tsx`
- Create: `src/features/sessions/components/SessionDetail.tsx`
- Create: `src/features/sessions/components/SignalChart.tsx`

These are UI-heavy components. The SessionsList shows session cards in the bottom sheet (Live/Sessions tabs). SessionDetail shows the map trail + chart. SignalChart renders an SVG line graph.

Implementation details for these files should follow the mockups approved during brainstorming (session cards with date, carrier, distance, avg dBm, stability badge; session detail with color-coded polyline trail + dBm chart + best/avg/worst stats).

- [ ] **Step 1: Create SignalChart component**

A simple SVG line chart using react-native-svg or inline SVG in a small WebView. Takes an array of `{ time: number, dbm: number }` data points and renders a line graph.

- [ ] **Step 2: Create SessionsList component**

List of session cards. Each card shows: time range, carrier · networkType · distance, avg dBm (color-coded), log count, stability badge. Fetches sessions via `api.sessions.listByDevice(deviceId)`.

- [ ] **Step 3: Create SessionDetail component**

Full-screen view with: map trail (inject polyline into Leaflet WebView), SignalChart, stats bar (best/avg/worst/logs). Fetches trail via `api.sessions.getTrail(sessionId)`.

- [ ] **Step 4: Integrate into MapScreen bottom sheet with Live/Sessions tabs**

Add tab switching to the bottom sheet. "Live" tab shows current signal display + Start Mapping button. "Sessions" tab shows SessionsList.

- [ ] **Step 5: Commit**

```bash
git add src/features/sessions/components/
git commit -m "feat(mobile): add SessionsList, SessionDetail, and SignalChart components"
```

---

## Task 9: Mobile — Routes List + Route Detail UI

**Files:**
- Create: `src/features/routes/hooks/use-routes.ts`
- Create: `src/features/routes/components/RoutesList.tsx`
- Create: `src/features/routes/components/RouteDetail.tsx`

- [ ] **Step 1: Create use-routes hook**

Hook that provides: `routes` list, `createRoute(name, sessionId)`, `addSessionToRoute(routeId, sessionId)`, `fetchRoutes()`. Uses `api.routes.*` methods.

- [ ] **Step 2: Create RoutesList component**

List of saved commute routes. Each card shows: route name, trip count, carrier, overall grade, last updated.

- [ ] **Step 3: Create RouteDetail component**

Shows route segments as a list. Each segment: label (KM 0-1), distance, activity badge (Gaming OK / Browse Only / Dead Zone), avg dBm. Dead zone segments highlighted red. Uses `getActivityLevel()` from activity-levels utility.

- [ ] **Step 4: Wire "Save as Route" from session complete alert**

When a session completes, the alert offers "Save as Route". This opens a prompt for the route name, then calls `createRoute(name, sessionId)`. If existing routes exist, also show "Add to Route" option with a picker.

- [ ] **Step 5: Commit**

```bash
git add src/features/routes/
git commit -m "feat(mobile): add RoutesList, RouteDetail, Save as Route flow"
```

---

## Task 10: Mobile — Work Spots + Reviews UI

**Files:**
- Create: `src/features/workspots/hooks/use-workspots.ts`
- Create: `src/features/workspots/components/WorkSpotsList.tsx`
- Create: `src/features/workspots/components/ReviewModal.tsx`

- [ ] **Step 1: Create use-workspots hook**

Hook that provides: `workZones` list, `nearbySpots`, `fetchNearby(lng, lat)`, `submitReview(review)`. Uses `api.workzones.*` methods.

- [ ] **Step 2: Create WorkSpotsList component**

Scrollable list of nearby work zones sorted by signal strength. Each card shows: area coordinates, best carrier + avg dBm + activity level badge, review count.

- [ ] **Step 3: Create ReviewModal component**

Modal for submitting carrier-specific reviews. Fields: carrier picker (GOMO, Smart, Globe, etc.), rating buttons (strong / ok / weak / dead), comment text input (200 char max). Submit saves to offline queue and syncs.

- [ ] **Step 4: Add work zone overlay toggle to MapScreen**

Toggle button on the map to show/hide green-shaded work zone overlay. Fetches work zones for current viewport via `api.workzones.query(bounds)`. Renders as green semi-transparent rectangles in the Leaflet WebView.

- [ ] **Step 5: Add long-press to open ReviewModal**

Long-press on the map captures the location coordinates and opens the ReviewModal pre-filled with the coordinates.

- [ ] **Step 6: Commit**

```bash
git add src/features/workspots/
git commit -m "feat(mobile): add WorkSpotsList, ReviewModal, work zone overlay"
```

---

## Task 11: Sync + Offline Queue Updates

**Files:**
- Modify: `src/features/offline-sync/services/log-store.ts`
- Modify: `src/features/offline-sync/services/sync-service.ts`

- [ ] **Step 1: Add session and review storage to log-store.ts**

Add `addSession`, `getUnsyncedSessions`, `markSessionSynced` functions following the same pattern as `addSignalLog`/`addReport`. Same for reviews: `addReview`, `getUnsyncedReviews`, `markReviewSynced`.

- [ ] **Step 2: Update sync-service to sync sessions and reviews**

After syncing signals and reports, also sync sessions and reviews using the same batch pattern. Strip local `_id` before uploading.

- [ ] **Step 3: Commit**

```bash
git add src/features/offline-sync/services/log-store.ts src/features/offline-sync/services/sync-service.ts
git commit -m "feat(sync): add session and review offline queue + sync"
```

---

## Task 12: Integration Test + Manual Device Test

- [ ] **Step 1: Test backend endpoints**

```bash
# Test all new endpoints
curl -s http://localhost:3000/api/health
curl -s -X POST http://localhost:3000/api/sessions -H "Content-Type: application/json" -d '{"deviceId":"test","startTime":"2026-03-30T12:00:00Z","carrier":"GOMO","networkType":"4G"}'
curl -s http://localhost:3000/api/sessions/device/test
curl -s http://localhost:3000/api/history?lng=121.09&lat=14.69&radius=500&days=7
curl -s http://localhost:3000/api/workzones/nearby?lng=121.09&lat=14.69&radius=1000
```

- [ ] **Step 2: Build APK and test on device**

```bash
cd /c/dev/signalog
npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res
cd android && ./gradlew.bat app:installDebug
```

Test flow:
1. Start Mapping → verify session created
2. Map for 2+ minutes → Stop Mapping → verify session complete alert with stats
3. Save as Route → name it → verify in routes list
4. View session detail → verify map trail + chart
5. Toggle work zones overlay → verify green zones (if enough data)
6. Long-press map → submit review → verify in database

- [ ] **Step 3: Final commit + push**

```bash
git add -A
git commit -m "feat: Phase 2a complete — sessions, routes, work spots, signal history"
git push
```
