# Signalog Backend Server — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Express API server with MongoDB that receives signal logs, manual reports, serves heatmap tiles, and exports data — fully testable without the mobile app.

**Architecture:** Express REST API backed by MongoDB with geospatial indexes. A separate cron-based aggregation worker pre-computes heatmap tiles. File uploads stored on local filesystem (MVP). No auth — devices identified by anonymous UUID.

**Tech Stack:** Node.js, Express, MongoDB, Mongoose, Multer (file uploads), node-cron, Jest, mongodb-memory-server

---

## File Structure

```
server/
├── config/
│   └── index.js              # DB connection, env vars, constants
├── models/
│   ├── signal-log.js         # SignalLog Mongoose schema + indexes
│   ├── manual-report.js      # ManualReport Mongoose schema
│   └── heatmap-tile.js       # HeatmapTile Mongoose schema
├── routes/
│   ├── signals.js            # POST /api/signals/batch, GET /api/signals
│   ├── reports.js            # POST /api/reports, GET /api/reports, POST /api/reports/upload
│   ├── heatmap.js            # GET /api/heatmap/tiles
│   ├── carriers.js           # GET /api/carriers
│   └── export.js             # GET /api/export/:deviceId
├── services/
│   ├── signal-service.js     # Signal log business logic
│   ├── report-service.js     # Report business logic
│   ├── heatmap-service.js    # Heatmap tile query logic
│   └── export-service.js     # CSV/JSON export generation
├── workers/
│   └── heatmap-aggregator.js # Cron job that pre-computes heatmap tiles
├── middleware/
│   └── validate.js           # Request validation middleware
├── app.js                    # Express app setup (no listen)
└── index.js                  # Server entry point (app.listen)

tests/
├── setup.js                  # MongoDB memory server setup/teardown
├── models/
│   ├── signal-log.test.js
│   ├── manual-report.test.js
│   └── heatmap-tile.test.js
├── routes/
│   ├── signals.test.js
│   ├── reports.test.js
│   ├── heatmap.test.js
│   ├── carriers.test.js
│   └── export.test.js
├── services/
│   └── export-service.test.js
└── workers/
    └── heatmap-aggregator.test.js

uploads/                      # Local file storage for photos/voice notes (gitignored)
```

---

### Task 1: Project Initialization

**Files:**
- Create: `server/package.json`
- Create: `server/.env.example`
- Create: `server/.gitignore`
- Create: `server/config/index.js`
- Create: `tests/setup.js`

- [ ] **Step 1: Initialize the server package**

```bash
cd signalogger && mkdir -p server && cd server
npm init -y
```

- [ ] **Step 2: Install dependencies**

```bash
cd signalogger/server
npm install express mongoose multer node-cron cors dotenv
npm install -D jest supertest mongodb-memory-server @types/jest
```

- [ ] **Step 3: Create .env.example**

Create `server/.env.example`:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/signalog
UPLOAD_DIR=./uploads
HEATMAP_CRON_INTERVAL=*/15 * * * *
```

- [ ] **Step 4: Create .gitignore**

Create `server/.gitignore`:

```
node_modules/
.env
uploads/
```

- [ ] **Step 5: Create server config**

Create `server/config/index.js`:

```js
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/signalog',
  uploadDir: process.env.UPLOAD_DIR || path.resolve(__dirname, '../uploads'),
  heatmapCronInterval: process.env.HEATMAP_CRON_INTERVAL || '*/15 * * * *',
  carriers: ['Smart', 'Globe', 'TNT', 'GOMO', 'Sun', 'DITO'],
  networkTypes: ['2G', '3G', '4G', '5G', 'none'],
  reportCategories: ['dead_zone', 'weak_signal', 'intermittent', 'slow_data'],
  sync: {
    maxBatchSize: 100,
  },
};

module.exports = config;
```

- [ ] **Step 6: Create test setup with MongoDB memory server**

Create `tests/setup.js`:

```js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
```

- [ ] **Step 7: Configure Jest in package.json**

Update `server/package.json` — add to the root object:

```json
{
  "scripts": {
    "start": "node index.js",
    "test": "jest --runInBand --forceExit",
    "test:watch": "jest --runInBand --watch"
  },
  "jest": {
    "testEnvironment": "node",
    "setupFilesAfterSetup": ["<rootDir>/../tests/setup.js"],
    "testMatch": ["**/tests/**/*.test.js"]
  }
}
```

- [ ] **Step 8: Create uploads directory**

```bash
mkdir -p signalogger/server/uploads
touch signalogger/server/uploads/.gitkeep
```

- [ ] **Step 9: Commit**

```bash
cd signalogger
git add server/ tests/setup.js
git commit -m "feat(server): initialize backend project with config and test setup"
```

---

### Task 2: SignalLog Model

**Files:**
- Create: `server/models/signal-log.js`
- Create: `tests/models/signal-log.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/models/signal-log.test.js`:

```js
require('../setup');
const SignalLog = require('../../server/models/signal-log');

describe('SignalLog Model', () => {
  const validLog = {
    timestamp: new Date(),
    location: {
      type: 'Point',
      coordinates: [121.0, 14.5],
      accuracy: 10,
    },
    carrier: 'Smart',
    networkType: '4G',
    signal: {
      dbm: -67,
    },
    connection: {
      isWifi: false,
    },
    deviceId: 'test-device-001',
    synced: false,
  };

  test('creates a valid signal log', async () => {
    const log = await SignalLog.create(validLog);
    expect(log._id).toBeDefined();
    expect(log.carrier).toBe('Smart');
    expect(log.signal.dbm).toBe(-67);
    expect(log.location.coordinates).toEqual([121.0, 14.5]);
  });

  test('requires carrier field', async () => {
    const { carrier, ...noCarrier } = validLog;
    await expect(SignalLog.create(noCarrier)).rejects.toThrow(/carrier/i);
  });

  test('requires networkType field', async () => {
    const { networkType, ...noType } = validLog;
    await expect(SignalLog.create(noType)).rejects.toThrow(/networkType/i);
  });

  test('requires location field', async () => {
    const { location, ...noLocation } = validLog;
    await expect(SignalLog.create(noLocation)).rejects.toThrow();
  });

  test('requires deviceId field', async () => {
    const { deviceId, ...noDevice } = validLog;
    await expect(SignalLog.create(noDevice)).rejects.toThrow(/deviceId/i);
  });

  test('allows optional signal fields', async () => {
    const log = await SignalLog.create({
      ...validLog,
      signal: {
        dbm: -67,
        rssi: -70,
        snr: 15.5,
        cellId: 'cell-123',
        bandFrequency: 1800,
      },
    });
    expect(log.signal.rssi).toBe(-70);
    expect(log.signal.snr).toBe(15.5);
    expect(log.signal.cellId).toBe('cell-123');
    expect(log.signal.bandFrequency).toBe(1800);
  });

  test('allows optional connection fields', async () => {
    const log = await SignalLog.create({
      ...validLog,
      connection: {
        downloadSpeed: 25.5,
        uploadSpeed: 10.2,
        ping: 23,
        isWifi: false,
      },
    });
    expect(log.connection.downloadSpeed).toBe(25.5);
    expect(log.connection.ping).toBe(23);
  });

  test('supports geospatial query with 2dsphere index', async () => {
    await SignalLog.create(validLog);
    await SignalLog.create({
      ...validLog,
      location: { type: 'Point', coordinates: [122.0, 15.0], accuracy: 5 },
    });

    const results = await SignalLog.find({
      location: {
        $geoWithin: {
          $box: [
            [120.5, 14.0],
            [121.5, 15.0],
          ],
        },
      },
    });
    expect(results).toHaveLength(1);
    expect(results[0].location.coordinates).toEqual([121.0, 14.5]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd signalogger/server && npm test -- tests/models/signal-log.test.js
```

Expected: FAIL — `Cannot find module '../../server/models/signal-log'`

- [ ] **Step 3: Write the SignalLog model**

Create `server/models/signal-log.js`:

```js
const mongoose = require('mongoose');

const signalLogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
    },
    accuracy: Number,
    altitude: Number,
  },
  carrier: {
    type: String,
    required: true,
    index: true,
  },
  networkType: {
    type: String,
    required: true,
    index: true,
  },
  signal: {
    dbm: { type: Number, required: true },
    rssi: Number,
    snr: Number,
    cellId: String,
    bandFrequency: Number,
  },
  connection: {
    downloadSpeed: Number,
    uploadSpeed: Number,
    ping: Number,
    isWifi: { type: Boolean, required: true },
  },
  deviceId: {
    type: String,
    required: true,
    index: true,
  },
  synced: {
    type: Boolean,
    default: false,
  },
});

signalLogSchema.index({ location: '2dsphere' });
signalLogSchema.index({ carrier: 1, networkType: 1 });
signalLogSchema.index({ deviceId: 1, synced: 1 });

module.exports = mongoose.model('SignalLog', signalLogSchema);
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd signalogger/server && npm test -- tests/models/signal-log.test.js
```

Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
cd signalogger
git add server/models/signal-log.js tests/models/signal-log.test.js
git commit -m "feat(server): add SignalLog model with geospatial indexes"
```

---

### Task 3: ManualReport Model

**Files:**
- Create: `server/models/manual-report.js`
- Create: `tests/models/manual-report.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/models/manual-report.test.js`:

```js
require('../setup');
const ManualReport = require('../../server/models/manual-report');

describe('ManualReport Model', () => {
  const validReport = {
    timestamp: new Date(),
    location: {
      type: 'Point',
      coordinates: [121.0, 14.5],
    },
    carrier: 'Globe',
    networkType: '3G',
    category: 'dead_zone',
    deviceId: 'test-device-001',
    synced: false,
  };

  test('creates a valid report', async () => {
    const report = await ManualReport.create(validReport);
    expect(report._id).toBeDefined();
    expect(report.category).toBe('dead_zone');
    expect(report.carrier).toBe('Globe');
  });

  test('requires category field', async () => {
    const { category, ...noCategory } = validReport;
    await expect(ManualReport.create(noCategory)).rejects.toThrow(/category/i);
  });

  test('validates category enum', async () => {
    await expect(
      ManualReport.create({ ...validReport, category: 'invalid' })
    ).rejects.toThrow(/category/i);
  });

  test('allows all valid categories', async () => {
    const categories = ['dead_zone', 'weak_signal', 'intermittent', 'slow_data'];
    for (const category of categories) {
      const report = await ManualReport.create({ ...validReport, category });
      expect(report.category).toBe(category);
    }
  });

  test('allows optional note with max 500 chars', async () => {
    const report = await ManualReport.create({
      ...validReport,
      note: 'No signal here at all',
    });
    expect(report.note).toBe('No signal here at all');
  });

  test('rejects note longer than 500 chars', async () => {
    await expect(
      ManualReport.create({ ...validReport, note: 'x'.repeat(501) })
    ).rejects.toThrow();
  });

  test('allows attachments array', async () => {
    const report = await ManualReport.create({
      ...validReport,
      attachments: [
        { type: 'photo', url: '/uploads/photo-123.jpg', size: 1024000 },
        { type: 'voice_note', url: '/uploads/voice-456.m4a', size: 512000 },
      ],
    });
    expect(report.attachments).toHaveLength(2);
    expect(report.attachments[0].type).toBe('photo');
    expect(report.attachments[1].type).toBe('voice_note');
  });

  test('supports geospatial query', async () => {
    await ManualReport.create(validReport);
    const results = await ManualReport.find({
      location: {
        $geoWithin: {
          $box: [
            [120.5, 14.0],
            [121.5, 15.0],
          ],
        },
      },
    });
    expect(results).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd signalogger/server && npm test -- tests/models/manual-report.test.js
```

Expected: FAIL — `Cannot find module '../../server/models/manual-report'`

- [ ] **Step 3: Write the ManualReport model**

Create `server/models/manual-report.js`:

```js
const mongoose = require('mongoose');

const manualReportSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  },
  carrier: {
    type: String,
    required: true,
  },
  networkType: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
    enum: ['dead_zone', 'weak_signal', 'intermittent', 'slow_data'],
  },
  note: {
    type: String,
    maxlength: 500,
  },
  attachments: [
    {
      type: {
        type: String,
        enum: ['photo', 'voice_note'],
      },
      url: String,
      size: Number,
    },
  ],
  deviceId: {
    type: String,
    required: true,
  },
  synced: {
    type: Boolean,
    default: false,
  },
});

manualReportSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('ManualReport', manualReportSchema);
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd signalogger/server && npm test -- tests/models/manual-report.test.js
```

Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
cd signalogger
git add server/models/manual-report.js tests/models/manual-report.test.js
git commit -m "feat(server): add ManualReport model with category validation"
```

---

### Task 4: HeatmapTile Model

**Files:**
- Create: `server/models/heatmap-tile.js`
- Create: `tests/models/heatmap-tile.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/models/heatmap-tile.test.js`:

```js
require('../setup');
const HeatmapTile = require('../../server/models/heatmap-tile');

describe('HeatmapTile Model', () => {
  const validTile = {
    bounds: {
      sw: [120.9, 14.4],
      ne: [121.0, 14.5],
    },
    zoomLevel: 12,
    carrier: 'all',
    networkType: 'all',
    avgDbm: -72.5,
    dataPointCount: 150,
    lastUpdated: new Date(),
  };

  test('creates a valid heatmap tile', async () => {
    const tile = await HeatmapTile.create(validTile);
    expect(tile._id).toBeDefined();
    expect(tile.avgDbm).toBe(-72.5);
    expect(tile.dataPointCount).toBe(150);
    expect(tile.bounds.sw).toEqual([120.9, 14.4]);
  });

  test('requires zoomLevel', async () => {
    const { zoomLevel, ...noZoom } = validTile;
    await expect(HeatmapTile.create(noZoom)).rejects.toThrow(/zoomLevel/i);
  });

  test('requires avgDbm', async () => {
    const { avgDbm, ...noDbm } = validTile;
    await expect(HeatmapTile.create(noDbm)).rejects.toThrow(/avgDbm/i);
  });

  test('can query by bounds, zoom, carrier, and networkType', async () => {
    await HeatmapTile.create(validTile);
    await HeatmapTile.create({
      ...validTile,
      carrier: 'Smart',
      networkType: '4G',
    });

    const smartTiles = await HeatmapTile.find({
      carrier: 'Smart',
      networkType: '4G',
      zoomLevel: 12,
    });
    expect(smartTiles).toHaveLength(1);
    expect(smartTiles[0].carrier).toBe('Smart');
  });

  test('can upsert tile by bounds + zoom + carrier + networkType', async () => {
    await HeatmapTile.create(validTile);

    await HeatmapTile.findOneAndUpdate(
      {
        'bounds.sw': [120.9, 14.4],
        'bounds.ne': [121.0, 14.5],
        zoomLevel: 12,
        carrier: 'all',
        networkType: 'all',
      },
      { avgDbm: -65.0, dataPointCount: 200, lastUpdated: new Date() },
      { upsert: true }
    );

    const tiles = await HeatmapTile.find({ carrier: 'all' });
    expect(tiles).toHaveLength(1);
    expect(tiles[0].avgDbm).toBe(-65.0);
    expect(tiles[0].dataPointCount).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd signalogger/server && npm test -- tests/models/heatmap-tile.test.js
```

Expected: FAIL — `Cannot find module '../../server/models/heatmap-tile'`

- [ ] **Step 3: Write the HeatmapTile model**

Create `server/models/heatmap-tile.js`:

```js
const mongoose = require('mongoose');

const heatmapTileSchema = new mongoose.Schema({
  bounds: {
    sw: {
      type: [Number],
      required: true,
    },
    ne: {
      type: [Number],
      required: true,
    },
  },
  zoomLevel: {
    type: Number,
    required: true,
  },
  carrier: {
    type: String,
    required: true,
    default: 'all',
  },
  networkType: {
    type: String,
    required: true,
    default: 'all',
  },
  avgDbm: {
    type: Number,
    required: true,
  },
  dataPointCount: {
    type: Number,
    required: true,
    default: 0,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

heatmapTileSchema.index(
  { 'bounds.sw': 1, 'bounds.ne': 1, zoomLevel: 1, carrier: 1, networkType: 1 },
  { unique: true }
);
heatmapTileSchema.index({ zoomLevel: 1, carrier: 1, networkType: 1 });

module.exports = mongoose.model('HeatmapTile', heatmapTileSchema);
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd signalogger/server && npm test -- tests/models/heatmap-tile.test.js
```

Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
cd signalogger
git add server/models/heatmap-tile.js tests/models/heatmap-tile.test.js
git commit -m "feat(server): add HeatmapTile model with compound index for upserts"
```

---

### Task 5: Express App Setup + Validation Middleware

**Files:**
- Create: `server/app.js`
- Create: `server/middleware/validate.js`

- [ ] **Step 1: Create validation middleware**

Create `server/middleware/validate.js`:

```js
function validateBounds(req, res, next) {
  const { sw_lng, sw_lat, ne_lng, ne_lat } = req.query;
  if (!sw_lng || !sw_lat || !ne_lng || !ne_lat) {
    return res.status(400).json({
      error: 'Missing viewport bounds. Required: sw_lng, sw_lat, ne_lng, ne_lat',
    });
  }

  const bounds = {
    sw: [parseFloat(sw_lng), parseFloat(sw_lat)],
    ne: [parseFloat(ne_lng), parseFloat(ne_lat)],
  };

  if (bounds.sw.some(isNaN) || bounds.ne.some(isNaN)) {
    return res.status(400).json({ error: 'Viewport bounds must be valid numbers' });
  }

  req.bounds = bounds;
  next();
}

function parseFilters(req, res, next) {
  req.filters = {};

  if (req.query.carrier) {
    req.filters.carrier = req.query.carrier.split(',').map((c) => c.trim());
  }

  if (req.query.networkType) {
    req.filters.networkType = req.query.networkType.split(',').map((t) => t.trim());
  }

  next();
}

module.exports = { validateBounds, parseFilters };
```

- [ ] **Step 2: Create Express app**

Create `server/app.js`:

```js
const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');

const signalsRouter = require('./routes/signals');
const reportsRouter = require('./routes/reports');
const heatmapRouter = require('./routes/heatmap');
const carriersRouter = require('./routes/carriers');
const exportRouter = require('./routes/export');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(config.uploadDir));

app.use('/api/signals', signalsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/heatmap', heatmapRouter);
app.use('/api/carriers', carriersRouter);
app.use('/api/export', exportRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = app;
```

- [ ] **Step 3: Create server entry point**

Create `server/index.js`:

```js
const mongoose = require('mongoose');
const config = require('./config');
const app = require('./app');

mongoose
  .connect(config.mongoUri)
  .then(() => {
    console.log('Connected to MongoDB');

    app.listen(config.port, () => {
      console.log(`Signalog API running on port ${config.port}`);
    });

    // Start heatmap aggregation worker
    require('./workers/heatmap-aggregator').start();
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
```

- [ ] **Step 4: Commit** (routes don't exist yet — we'll create stub files in the next tasks)

Note: Do NOT run the app yet. The route files don't exist. We commit the app shell and middleware, then build routes one by one in the following tasks.

```bash
cd signalogger
git add server/app.js server/index.js server/middleware/validate.js
git commit -m "feat(server): add Express app shell and validation middleware"
```

---

### Task 6: Signals Route — POST /api/signals/batch

**Files:**
- Create: `server/services/signal-service.js`
- Create: `server/routes/signals.js`
- Create: `tests/routes/signals.test.js`

- [ ] **Step 1: Create signal service**

Create `server/services/signal-service.js`:

```js
const SignalLog = require('../models/signal-log');

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
  const query = {
    location: {
      $geoWithin: {
        $box: [bounds.sw, bounds.ne],
      },
    },
  };

  if (filters.carrier && filters.carrier.length > 0) {
    query.carrier = { $in: filters.carrier };
  }
  if (filters.networkType && filters.networkType.length > 0) {
    query.networkType = { $in: filters.networkType };
  }

  return SignalLog.find(query).sort({ timestamp: -1 }).limit(500).lean();
}

module.exports = { createBatch, queryByViewport };
```

- [ ] **Step 2: Create signals route**

Create `server/routes/signals.js`:

```js
const express = require('express');
const router = express.Router();
const { validateBounds, parseFilters } = require('../middleware/validate');
const signalService = require('../services/signal-service');

router.post('/batch', async (req, res) => {
  try {
    const signals = req.body;
    const result = await signalService.createBatch(signals);
    res.status(201).json({ inserted: result.length });
  } catch (err) {
    if (err.message.includes('non-empty array') || err.message.includes('exceed 100')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to insert signal logs' });
  }
});

router.get('/', validateBounds, parseFilters, async (req, res) => {
  try {
    const signals = await signalService.queryByViewport(req.bounds, req.filters);
    res.json({ data: signals, count: signals.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to query signals' });
  }
});

module.exports = router;
```

- [ ] **Step 3: Write the failing test**

Create `tests/routes/signals.test.js`:

```js
require('../setup');
const request = require('supertest');
const app = require('../../server/app');
const SignalLog = require('../../server/models/signal-log');

describe('Signals API', () => {
  const validSignal = {
    timestamp: new Date().toISOString(),
    location: {
      type: 'Point',
      coordinates: [121.0, 14.5],
      accuracy: 10,
    },
    carrier: 'Smart',
    networkType: '4G',
    signal: { dbm: -67 },
    connection: { isWifi: false },
    deviceId: 'test-device-001',
    synced: false,
  };

  describe('POST /api/signals/batch', () => {
    test('inserts a batch of signal logs', async () => {
      const res = await request(app)
        .post('/api/signals/batch')
        .send([validSignal, { ...validSignal, carrier: 'Globe' }]);

      expect(res.status).toBe(201);
      expect(res.body.inserted).toBe(2);

      const count = await SignalLog.countDocuments();
      expect(count).toBe(2);
    });

    test('rejects empty array', async () => {
      const res = await request(app).post('/api/signals/batch').send([]);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/non-empty/);
    });

    test('rejects batch larger than 100', async () => {
      const batch = Array(101).fill(validSignal);
      const res = await request(app).post('/api/signals/batch').send(batch);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/exceed 100/);
    });
  });

  describe('GET /api/signals', () => {
    beforeEach(async () => {
      await SignalLog.create([
        validSignal,
        {
          ...validSignal,
          location: { type: 'Point', coordinates: [122.0, 15.0], accuracy: 5 },
          carrier: 'Globe',
        },
        {
          ...validSignal,
          carrier: 'TNT',
          networkType: '3G',
        },
      ]);
    });

    test('requires viewport bounds', async () => {
      const res = await request(app).get('/api/signals');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/bounds/i);
    });

    test('returns signals within viewport', async () => {
      const res = await request(app).get('/api/signals').query({
        sw_lng: 120.5,
        sw_lat: 14.0,
        ne_lng: 121.5,
        ne_lat: 15.0,
      });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2); // Only 2 within this box
    });

    test('filters by carrier', async () => {
      const res = await request(app).get('/api/signals').query({
        sw_lng: 120.0,
        sw_lat: 14.0,
        ne_lng: 123.0,
        ne_lat: 16.0,
        carrier: 'Smart',
      });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].carrier).toBe('Smart');
    });

    test('filters by multiple carriers', async () => {
      const res = await request(app).get('/api/signals').query({
        sw_lng: 120.0,
        sw_lat: 14.0,
        ne_lng: 123.0,
        ne_lat: 16.0,
        carrier: 'Smart,TNT',
      });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
    });

    test('filters by networkType', async () => {
      const res = await request(app).get('/api/signals').query({
        sw_lng: 120.0,
        sw_lat: 14.0,
        ne_lng: 123.0,
        ne_lat: 16.0,
        networkType: '3G',
      });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].networkType).toBe('3G');
    });
  });
});
```

- [ ] **Step 4: Run tests to verify they pass**

Note: The route file already exists from Step 2, so these should pass immediately. If not, debug.

```bash
cd signalogger/server && npm test -- tests/routes/signals.test.js
```

Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
cd signalogger
git add server/services/signal-service.js server/routes/signals.js tests/routes/signals.test.js
git commit -m "feat(server): add signals batch upload and geospatial query endpoints"
```

---

### Task 7: Reports Route — POST + GET /api/reports

**Files:**
- Create: `server/services/report-service.js`
- Create: `server/routes/reports.js`
- Create: `tests/routes/reports.test.js`

- [ ] **Step 1: Create report service**

Create `server/services/report-service.js`:

```js
const ManualReport = require('../models/manual-report');
const config = require('../config');

async function createReport(data) {
  if (!data.category || !config.reportCategories.includes(data.category)) {
    throw new Error(
      `Invalid category. Must be one of: ${config.reportCategories.join(', ')}`
    );
  }
  return ManualReport.create(data);
}

async function queryByViewport(bounds, filters = {}) {
  const query = {
    location: {
      $geoWithin: {
        $box: [bounds.sw, bounds.ne],
      },
    },
  };

  if (filters.carrier && filters.carrier.length > 0) {
    query.carrier = { $in: filters.carrier };
  }
  if (filters.networkType && filters.networkType.length > 0) {
    query.networkType = { $in: filters.networkType };
  }

  return ManualReport.find(query).sort({ timestamp: -1 }).limit(200).lean();
}

async function addAttachment(reportId, attachment) {
  return ManualReport.findByIdAndUpdate(
    reportId,
    { $push: { attachments: attachment } },
    { new: true }
  );
}

module.exports = { createReport, queryByViewport, addAttachment };
```

- [ ] **Step 2: Create reports route**

Create `server/routes/reports.js`:

```js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const config = require('../config');
const { validateBounds, parseFilters } = require('../middleware/validate');
const reportService = require('../services/report-service');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(
      file.originalname
    )}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'audio/mp4',
      'audio/m4a',
      'audio/mpeg',
      'audio/wav',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

router.post('/', async (req, res) => {
  try {
    const report = await reportService.createReport(req.body);
    res.status(201).json(report);
  } catch (err) {
    if (err.message.includes('Invalid category')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to create report' });
  }
});

router.get('/', validateBounds, parseFilters, async (req, res) => {
  try {
    const reports = await reportService.queryByViewport(req.bounds, req.filters);
    res.json({ data: reports, count: reports.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to query reports' });
  }
});

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    if (!req.body.reportId) {
      return res.status(400).json({ error: 'reportId is required' });
    }

    const fileType = req.file.mimetype.startsWith('image/') ? 'photo' : 'voice_note';
    const attachment = {
      type: fileType,
      url: `/uploads/${req.file.filename}`,
      size: req.file.size,
    };

    const report = await reportService.addAttachment(req.body.reportId, attachment);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.status(201).json(attachment);
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

module.exports = router;
```

- [ ] **Step 3: Write the failing test**

Create `tests/routes/reports.test.js`:

```js
require('../setup');
const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../../server/app');
const ManualReport = require('../../server/models/manual-report');
const config = require('../../server/config');

describe('Reports API', () => {
  const validReport = {
    timestamp: new Date().toISOString(),
    location: { type: 'Point', coordinates: [121.0, 14.5] },
    carrier: 'Smart',
    networkType: '4G',
    category: 'dead_zone',
    deviceId: 'test-device-001',
  };

  // Ensure uploads dir exists for tests
  beforeAll(() => {
    if (!fs.existsSync(config.uploadDir)) {
      fs.mkdirSync(config.uploadDir, { recursive: true });
    }
  });

  describe('POST /api/reports', () => {
    test('creates a valid report', async () => {
      const res = await request(app).post('/api/reports').send(validReport);

      expect(res.status).toBe(201);
      expect(res.body.category).toBe('dead_zone');
      expect(res.body._id).toBeDefined();
    });

    test('creates report with note', async () => {
      const res = await request(app)
        .post('/api/reports')
        .send({ ...validReport, note: 'Totally dead here' });

      expect(res.status).toBe(201);
      expect(res.body.note).toBe('Totally dead here');
    });

    test('rejects invalid category', async () => {
      const res = await request(app)
        .post('/api/reports')
        .send({ ...validReport, category: 'fake_category' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid category/);
    });
  });

  describe('GET /api/reports', () => {
    beforeEach(async () => {
      await ManualReport.create([
        validReport,
        {
          ...validReport,
          location: { type: 'Point', coordinates: [122.0, 15.0] },
          category: 'weak_signal',
          carrier: 'Globe',
        },
      ]);
    });

    test('returns reports within viewport', async () => {
      const res = await request(app).get('/api/reports').query({
        sw_lng: 120.5,
        sw_lat: 14.0,
        ne_lng: 121.5,
        ne_lat: 15.0,
      });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].category).toBe('dead_zone');
    });

    test('filters by carrier', async () => {
      const res = await request(app).get('/api/reports').query({
        sw_lng: 120.0,
        sw_lat: 14.0,
        ne_lng: 123.0,
        ne_lat: 16.0,
        carrier: 'Globe',
      });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].carrier).toBe('Globe');
    });
  });

  describe('POST /api/reports/upload', () => {
    test('uploads a photo and attaches to report', async () => {
      const report = await ManualReport.create(validReport);

      // Create a tiny test file
      const testFilePath = path.join(config.uploadDir, 'test-photo.jpg');
      fs.writeFileSync(testFilePath, Buffer.alloc(100, 0xff));

      const res = await request(app)
        .post('/api/reports/upload')
        .field('reportId', report._id.toString())
        .attach('file', testFilePath);

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('photo');
      expect(res.body.url).toMatch(/\/uploads\//);
      expect(res.body.size).toBeGreaterThan(0);

      // Verify attachment was added to report
      const updated = await ManualReport.findById(report._id);
      expect(updated.attachments).toHaveLength(1);

      // Cleanup
      fs.unlinkSync(testFilePath);
    });

    test('rejects upload without reportId', async () => {
      const testFilePath = path.join(config.uploadDir, 'test-photo2.jpg');
      fs.writeFileSync(testFilePath, Buffer.alloc(100, 0xff));

      const res = await request(app)
        .post('/api/reports/upload')
        .attach('file', testFilePath);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/reportId/);

      fs.unlinkSync(testFilePath);
    });
  });
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd signalogger/server && npm test -- tests/routes/reports.test.js
```

Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
cd signalogger
git add server/services/report-service.js server/routes/reports.js tests/routes/reports.test.js
git commit -m "feat(server): add reports CRUD with file upload support"
```

---

### Task 8: Heatmap Route — GET /api/heatmap/tiles

**Files:**
- Create: `server/services/heatmap-service.js`
- Create: `server/routes/heatmap.js`
- Create: `tests/routes/heatmap.test.js`

- [ ] **Step 1: Create heatmap service**

Create `server/services/heatmap-service.js`:

```js
const HeatmapTile = require('../models/heatmap-tile');

async function queryTiles(bounds, zoom, filters = {}) {
  const query = {
    'bounds.sw.0': { $gte: bounds.sw[0] },
    'bounds.sw.1': { $gte: bounds.sw[1] },
    'bounds.ne.0': { $lte: bounds.ne[0] },
    'bounds.ne.1': { $lte: bounds.ne[1] },
    zoomLevel: parseInt(zoom, 10) || 12,
  };

  if (filters.carrier && filters.carrier.length > 0) {
    query.carrier = { $in: [...filters.carrier, 'all'] };
  }
  if (filters.networkType && filters.networkType.length > 0) {
    query.networkType = { $in: [...filters.networkType, 'all'] };
  }

  return HeatmapTile.find(query).lean();
}

module.exports = { queryTiles };
```

- [ ] **Step 2: Create heatmap route**

Create `server/routes/heatmap.js`:

```js
const express = require('express');
const router = express.Router();
const { validateBounds, parseFilters } = require('../middleware/validate');
const heatmapService = require('../services/heatmap-service');

router.get('/tiles', validateBounds, parseFilters, async (req, res) => {
  try {
    const zoom = req.query.zoom || 12;
    const tiles = await heatmapService.queryTiles(req.bounds, zoom, req.filters);
    res.json({ data: tiles, count: tiles.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to query heatmap tiles' });
  }
});

module.exports = router;
```

- [ ] **Step 3: Write the failing test**

Create `tests/routes/heatmap.test.js`:

```js
require('../setup');
const request = require('supertest');
const app = require('../../server/app');
const HeatmapTile = require('../../server/models/heatmap-tile');

describe('Heatmap API', () => {
  beforeEach(async () => {
    await HeatmapTile.create([
      {
        bounds: { sw: [120.9, 14.4], ne: [121.0, 14.5] },
        zoomLevel: 12,
        carrier: 'all',
        networkType: 'all',
        avgDbm: -72.5,
        dataPointCount: 150,
      },
      {
        bounds: { sw: [121.0, 14.5], ne: [121.1, 14.6] },
        zoomLevel: 12,
        carrier: 'Smart',
        networkType: '4G',
        avgDbm: -60.0,
        dataPointCount: 80,
      },
      {
        bounds: { sw: [125.0, 10.0], ne: [125.1, 10.1] },
        zoomLevel: 12,
        carrier: 'all',
        networkType: 'all',
        avgDbm: -85.0,
        dataPointCount: 30,
      },
    ]);
  });

  describe('GET /api/heatmap/tiles', () => {
    test('requires viewport bounds', async () => {
      const res = await request(app).get('/api/heatmap/tiles');
      expect(res.status).toBe(400);
    });

    test('returns tiles within viewport', async () => {
      const res = await request(app).get('/api/heatmap/tiles').query({
        sw_lng: 120.0,
        sw_lat: 14.0,
        ne_lng: 122.0,
        ne_lat: 15.0,
        zoom: 12,
      });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2); // Manila area tiles, not Cebu
    });

    test('filters by carrier', async () => {
      const res = await request(app).get('/api/heatmap/tiles').query({
        sw_lng: 120.0,
        sw_lat: 14.0,
        ne_lng: 122.0,
        ne_lat: 15.0,
        zoom: 12,
        carrier: 'Smart',
      });

      expect(res.status).toBe(200);
      // Should return Smart-specific tiles + "all" tiles
      const carriers = res.body.data.map((t) => t.carrier);
      expect(carriers).toContain('Smart');
      expect(carriers).toContain('all');
    });
  });
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd signalogger/server && npm test -- tests/routes/heatmap.test.js
```

Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
cd signalogger
git add server/services/heatmap-service.js server/routes/heatmap.js tests/routes/heatmap.test.js
git commit -m "feat(server): add heatmap tiles endpoint with geospatial + filter queries"
```

---

### Task 9: Carriers Route — GET /api/carriers

**Files:**
- Create: `server/routes/carriers.js`
- Create: `tests/routes/carriers.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/routes/carriers.test.js`:

```js
require('../setup');
const request = require('supertest');
const app = require('../../server/app');

describe('Carriers API', () => {
  describe('GET /api/carriers', () => {
    test('returns list of carriers', async () => {
      const res = await request(app).get('/api/carriers');

      expect(res.status).toBe(200);
      expect(res.body.carriers).toEqual([
        'Smart',
        'Globe',
        'TNT',
        'GOMO',
        'Sun',
        'DITO',
      ]);
    });

    test('returns list of network types', async () => {
      const res = await request(app).get('/api/carriers');

      expect(res.status).toBe(200);
      expect(res.body.networkTypes).toEqual(['2G', '3G', '4G', '5G', 'none']);
    });

    test('returns report categories', async () => {
      const res = await request(app).get('/api/carriers');

      expect(res.status).toBe(200);
      expect(res.body.reportCategories).toEqual([
        'dead_zone',
        'weak_signal',
        'intermittent',
        'slow_data',
      ]);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd signalogger/server && npm test -- tests/routes/carriers.test.js
```

Expected: FAIL — `Cannot find module '../../server/routes/carriers'`

- [ ] **Step 3: Create carriers route**

Create `server/routes/carriers.js`:

```js
const express = require('express');
const router = express.Router();
const config = require('../config');

router.get('/', (req, res) => {
  res.json({
    carriers: config.carriers,
    networkTypes: config.networkTypes,
    reportCategories: config.reportCategories,
  });
});

module.exports = router;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd signalogger/server && npm test -- tests/routes/carriers.test.js
```

Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
cd signalogger
git add server/routes/carriers.js tests/routes/carriers.test.js
git commit -m "feat(server): add carriers endpoint with static config data"
```

---

### Task 10: Export Route — GET /api/export/:deviceId

**Files:**
- Create: `server/services/export-service.js`
- Create: `server/routes/export.js`
- Create: `tests/services/export-service.test.js`
- Create: `tests/routes/export.test.js`

- [ ] **Step 1: Write the export service test**

Create `tests/services/export-service.test.js`:

```js
require('../setup');
const SignalLog = require('../../server/models/signal-log');
const exportService = require('../../server/services/export-service');

describe('Export Service', () => {
  const deviceId = 'export-test-device';

  beforeEach(async () => {
    await SignalLog.create([
      {
        timestamp: new Date('2026-03-01T10:00:00Z'),
        location: { type: 'Point', coordinates: [121.0, 14.5], accuracy: 10 },
        carrier: 'Smart',
        networkType: '4G',
        signal: { dbm: -67, snr: 15 },
        connection: { isWifi: false, ping: 23 },
        deviceId,
        synced: true,
      },
      {
        timestamp: new Date('2026-03-01T10:01:00Z'),
        location: { type: 'Point', coordinates: [121.1, 14.6], accuracy: 5 },
        carrier: 'Globe',
        networkType: '5G',
        signal: { dbm: -55 },
        connection: { isWifi: false, downloadSpeed: 50 },
        deviceId,
        synced: true,
      },
    ]);
  });

  test('exports as JSON', async () => {
    const result = await exportService.exportData(deviceId, 'json');
    expect(result.contentType).toBe('application/json');
    const parsed = JSON.parse(result.data);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].carrier).toBe('Smart');
  });

  test('exports as CSV', async () => {
    const result = await exportService.exportData(deviceId, 'csv');
    expect(result.contentType).toBe('text/csv');
    const lines = result.data.split('\n');
    expect(lines[0]).toContain('timestamp');
    expect(lines[0]).toContain('carrier');
    expect(lines[0]).toContain('dbm');
    expect(lines).toHaveLength(3); // header + 2 rows
  });

  test('returns empty for unknown device', async () => {
    const result = await exportService.exportData('unknown-device', 'json');
    const parsed = JSON.parse(result.data);
    expect(parsed).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd signalogger/server && npm test -- tests/services/export-service.test.js
```

Expected: FAIL — `Cannot find module '../../server/services/export-service'`

- [ ] **Step 3: Create export service**

Create `server/services/export-service.js`:

```js
const SignalLog = require('../models/signal-log');

async function exportData(deviceId, format) {
  const logs = await SignalLog.find({ deviceId })
    .sort({ timestamp: 1 })
    .lean();

  if (format === 'csv') {
    return {
      contentType: 'text/csv',
      data: toCsv(logs),
      filename: `signalog-${deviceId}.csv`,
    };
  }

  return {
    contentType: 'application/json',
    data: JSON.stringify(logs),
    filename: `signalog-${deviceId}.json`,
  };
}

function toCsv(logs) {
  const headers = [
    'timestamp',
    'latitude',
    'longitude',
    'accuracy',
    'carrier',
    'networkType',
    'dbm',
    'rssi',
    'snr',
    'cellId',
    'bandFrequency',
    'downloadSpeed',
    'uploadSpeed',
    'ping',
    'isWifi',
  ];

  const rows = logs.map((log) =>
    [
      log.timestamp ? new Date(log.timestamp).toISOString() : '',
      log.location?.coordinates?.[1] ?? '',
      log.location?.coordinates?.[0] ?? '',
      log.location?.accuracy ?? '',
      log.carrier ?? '',
      log.networkType ?? '',
      log.signal?.dbm ?? '',
      log.signal?.rssi ?? '',
      log.signal?.snr ?? '',
      log.signal?.cellId ?? '',
      log.signal?.bandFrequency ?? '',
      log.connection?.downloadSpeed ?? '',
      log.connection?.uploadSpeed ?? '',
      log.connection?.ping ?? '',
      log.connection?.isWifi ?? '',
    ].join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

module.exports = { exportData };
```

- [ ] **Step 4: Run export service test to verify it passes**

```bash
cd signalogger/server && npm test -- tests/services/export-service.test.js
```

Expected: All 3 tests PASS

- [ ] **Step 5: Write the export route test**

Create `tests/routes/export.test.js`:

```js
require('../setup');
const request = require('supertest');
const app = require('../../server/app');
const SignalLog = require('../../server/models/signal-log');

describe('Export API', () => {
  const deviceId = 'export-route-device';

  beforeEach(async () => {
    await SignalLog.create({
      timestamp: new Date(),
      location: { type: 'Point', coordinates: [121.0, 14.5], accuracy: 10 },
      carrier: 'Smart',
      networkType: '4G',
      signal: { dbm: -67 },
      connection: { isWifi: false },
      deviceId,
      synced: true,
    });
  });

  test('exports JSON by default', async () => {
    const res = await request(app).get(`/api/export/${deviceId}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toHaveLength(1);
  });

  test('exports CSV when format=csv', async () => {
    const res = await request(app)
      .get(`/api/export/${deviceId}`)
      .query({ format: 'csv' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/csv/);
    expect(res.text).toContain('timestamp');
    expect(res.text).toContain('Smart');
  });

  test('returns empty array for unknown device', async () => {
    const res = await request(app).get('/api/export/unknown-device');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});
```

- [ ] **Step 6: Create export route**

Create `server/routes/export.js`:

```js
const express = require('express');
const router = express.Router();
const exportService = require('../services/export-service');

router.get('/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const format = req.query.format || 'json';
    const result = await exportService.exportData(deviceId, format);

    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`
    );
    res.send(result.data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to export data' });
  }
});

module.exports = router;
```

- [ ] **Step 7: Run all export tests**

```bash
cd signalogger/server && npm test -- tests/routes/export.test.js tests/services/export-service.test.js
```

Expected: All 6 tests PASS

- [ ] **Step 8: Commit**

```bash
cd signalogger
git add server/services/export-service.js server/routes/export.js tests/services/export-service.test.js tests/routes/export.test.js
git commit -m "feat(server): add data export endpoint with CSV and JSON support"
```

---

### Task 11: Heatmap Aggregation Worker

**Files:**
- Create: `server/workers/heatmap-aggregator.js`
- Create: `tests/workers/heatmap-aggregator.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/workers/heatmap-aggregator.test.js`:

```js
require('../setup');
const SignalLog = require('../../server/models/signal-log');
const HeatmapTile = require('../../server/models/heatmap-tile');
const { aggregate } = require('../../server/workers/heatmap-aggregator');

describe('Heatmap Aggregator', () => {
  beforeEach(async () => {
    // Create signal logs in a small area
    const baseLog = {
      location: { type: 'Point', coordinates: [121.0, 14.5], accuracy: 10 },
      carrier: 'Smart',
      networkType: '4G',
      signal: { dbm: -60 },
      connection: { isWifi: false },
      deviceId: 'device-001',
      synced: true,
    };

    await SignalLog.create([
      { ...baseLog, timestamp: new Date(), signal: { dbm: -60 } },
      { ...baseLog, timestamp: new Date(), signal: { dbm: -70 } },
      { ...baseLog, timestamp: new Date(), signal: { dbm: -80 } },
      {
        ...baseLog,
        timestamp: new Date(),
        carrier: 'Globe',
        networkType: '5G',
        signal: { dbm: -50 },
      },
    ]);
  });

  test('creates heatmap tiles with averaged signal strength', async () => {
    await aggregate();

    const allTiles = await HeatmapTile.find({ carrier: 'all' });
    expect(allTiles.length).toBeGreaterThan(0);

    const tile = allTiles[0];
    expect(tile.dataPointCount).toBe(4);
    // Average of -60, -70, -80, -50 = -65
    expect(tile.avgDbm).toBe(-65);
  });

  test('creates per-carrier tiles', async () => {
    await aggregate();

    const smartTiles = await HeatmapTile.find({
      carrier: 'Smart',
      networkType: '4G',
    });
    expect(smartTiles.length).toBeGreaterThan(0);
    expect(smartTiles[0].dataPointCount).toBe(3);
    // Average of -60, -70, -80 = -70
    expect(smartTiles[0].avgDbm).toBeCloseTo(-70, 0);
  });

  test('upserts tiles on re-run (no duplicates)', async () => {
    await aggregate();
    await aggregate();

    const allTiles = await HeatmapTile.find({ carrier: 'all' });
    // Should still be 1 tile for this area, not 2
    expect(allTiles.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd signalogger/server && npm test -- tests/workers/heatmap-aggregator.test.js
```

Expected: FAIL — `Cannot find module '../../server/workers/heatmap-aggregator'`

- [ ] **Step 3: Create the aggregation worker**

Create `server/workers/heatmap-aggregator.js`:

```js
const cron = require('node-cron');
const SignalLog = require('../models/signal-log');
const HeatmapTile = require('../models/heatmap-tile');
const config = require('../config');

// Tile size in degrees per zoom level (approximate)
const TILE_SIZE = {
  10: 0.1,
  12: 0.01,
  14: 0.005,
};
const ZOOM_LEVELS = [10, 12, 14];

function getTileBounds(lng, lat, tileSize) {
  const sw_lng = Math.floor(lng / tileSize) * tileSize;
  const sw_lat = Math.floor(lat / tileSize) * tileSize;
  return {
    sw: [parseFloat(sw_lng.toFixed(6)), parseFloat(sw_lat.toFixed(6))],
    ne: [
      parseFloat((sw_lng + tileSize).toFixed(6)),
      parseFloat((sw_lat + tileSize).toFixed(6)),
    ],
  };
}

async function aggregate() {
  for (const zoom of ZOOM_LEVELS) {
    const tileSize = TILE_SIZE[zoom];

    // Get all signal logs grouped by tile + carrier + networkType
    const pipeline = [
      {
        $group: {
          _id: {
            tileLng: {
              $multiply: [{ $floor: { $divide: [{ $arrayElemAt: ['$location.coordinates', 0] }, tileSize] } }, tileSize],
            },
            tileLat: {
              $multiply: [{ $floor: { $divide: [{ $arrayElemAt: ['$location.coordinates', 1] }, tileSize] } }, tileSize],
            },
            carrier: '$carrier',
            networkType: '$networkType',
          },
          avgDbm: { $avg: '$signal.dbm' },
          count: { $sum: 1 },
        },
      },
    ];

    const results = await SignalLog.aggregate(pipeline);

    for (const result of results) {
      const bounds = {
        sw: [
          parseFloat(result._id.tileLng.toFixed(6)),
          parseFloat(result._id.tileLat.toFixed(6)),
        ],
        ne: [
          parseFloat((result._id.tileLng + tileSize).toFixed(6)),
          parseFloat((result._id.tileLat + tileSize).toFixed(6)),
        ],
      };

      // Upsert per-carrier tile
      await HeatmapTile.findOneAndUpdate(
        {
          'bounds.sw': bounds.sw,
          'bounds.ne': bounds.ne,
          zoomLevel: zoom,
          carrier: result._id.carrier,
          networkType: result._id.networkType,
        },
        {
          avgDbm: Math.round(result.avgDbm),
          dataPointCount: result.count,
          lastUpdated: new Date(),
        },
        { upsert: true }
      );
    }

    // Also compute "all" carrier tiles per grid cell
    const allPipeline = [
      {
        $group: {
          _id: {
            tileLng: {
              $multiply: [{ $floor: { $divide: [{ $arrayElemAt: ['$location.coordinates', 0] }, tileSize] } }, tileSize],
            },
            tileLat: {
              $multiply: [{ $floor: { $divide: [{ $arrayElemAt: ['$location.coordinates', 1] }, tileSize] } }, tileSize],
            },
          },
          avgDbm: { $avg: '$signal.dbm' },
          count: { $sum: 1 },
        },
      },
    ];

    const allResults = await SignalLog.aggregate(allPipeline);

    for (const result of allResults) {
      const bounds = {
        sw: [
          parseFloat(result._id.tileLng.toFixed(6)),
          parseFloat(result._id.tileLat.toFixed(6)),
        ],
        ne: [
          parseFloat((result._id.tileLng + tileSize).toFixed(6)),
          parseFloat((result._id.tileLat + tileSize).toFixed(6)),
        ],
      };

      await HeatmapTile.findOneAndUpdate(
        {
          'bounds.sw': bounds.sw,
          'bounds.ne': bounds.ne,
          zoomLevel: zoom,
          carrier: 'all',
          networkType: 'all',
        },
        {
          avgDbm: Math.round(result.avgDbm),
          dataPointCount: result.count,
          lastUpdated: new Date(),
        },
        { upsert: true }
      );
    }
  }

  console.log(`[Heatmap Aggregator] Completed at ${new Date().toISOString()}`);
}

function start() {
  console.log(`[Heatmap Aggregator] Scheduled: ${config.heatmapCronInterval}`);
  cron.schedule(config.heatmapCronInterval, aggregate);
}

module.exports = { start, aggregate };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd signalogger/server && npm test -- tests/workers/heatmap-aggregator.test.js
```

Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
cd signalogger
git add server/workers/heatmap-aggregator.js tests/workers/heatmap-aggregator.test.js
git commit -m "feat(server): add heatmap aggregation worker with per-carrier and zoom-level tiles"
```

---

### Task 12: Run Full Test Suite + Health Check

**Files:**
- No new files — validation task

- [ ] **Step 1: Run the full test suite**

```bash
cd signalogger/server && npm test
```

Expected: All tests PASS (approximately 30+ tests across all files)

- [ ] **Step 2: Fix any failures**

If any tests fail, read the error, fix the issue, and re-run.

- [ ] **Step 3: Test the health endpoint manually (optional)**

If you have MongoDB running locally:

```bash
cd signalogger/server
cp .env.example .env
node index.js
```

Then in another terminal:

```bash
curl http://localhost:3000/api/health
```

Expected: `{"status":"ok","timestamp":"2026-03-28T..."}`

```bash
curl http://localhost:3000/api/carriers
```

Expected: `{"carriers":["Smart","Globe","TNT","GOMO","Sun","DITO"],...}`

- [ ] **Step 4: Final commit**

```bash
cd signalogger
git add -A
git commit -m "feat(server): complete backend API — all tests passing"
```

---

## Summary

| Task | What | Tests |
|------|------|-------|
| 1 | Project init, config, test setup | — |
| 2 | SignalLog model + geospatial index | 7 |
| 3 | ManualReport model + validation | 8 |
| 4 | HeatmapTile model + compound index | 5 |
| 5 | Express app + validation middleware | — |
| 6 | POST/GET /api/signals | 7 |
| 7 | POST/GET /api/reports + file upload | 7 |
| 8 | GET /api/heatmap/tiles | 3 |
| 9 | GET /api/carriers | 3 |
| 10 | GET /api/export/:deviceId (CSV/JSON) | 6 |
| 11 | Heatmap aggregation worker (cron) | 3 |
| 12 | Full test suite validation | — |

**Total: 12 tasks, ~49 tests**
