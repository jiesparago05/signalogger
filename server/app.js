const express = require('express');
const cors = require('cors');
const config = require('./config');

const signalsRouter = require('./routes/signals');
const reportsRouter = require('./routes/reports');
const heatmapRouter = require('./routes/heatmap');
const carriersRouter = require('./routes/carriers');
const exportRouter = require('./routes/export');
const sessionsRouter = require('./routes/sessions');
const routesRouter = require('./routes/routes');
const historyRouter = require('./routes/history');
const workzonesRouter = require('./routes/workzones');
const compareRouter = require('./routes/compare');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(config.uploadDir));

app.use('/api/signals', signalsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/heatmap', heatmapRouter);
app.use('/api/carriers', carriersRouter);
app.use('/api/export', exportRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/routes', routesRouter);
app.use('/api/history', historyRouter);
app.use('/api/workzones', workzonesRouter);
app.use('/api/compare', compareRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/admin/consolidate', async (req, res) => {
  try {
    const { consolidate } = require('./workers/consolidation-worker');
    await consolidate();
    res.json({ status: 'ok', message: 'Consolidation complete' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/normalize-carriers', async (req, res) => {
  try {
    const SignalLog = require('./models/signal-log');
    const ConsolidatedSignal = require('./models/consolidated-signal');
    const MappingSession = require('./models/mapping-session');
    const SignalHistory = require('./models/signal-history');
    const HeatmapTile = require('./models/heatmap-tile');
    // Regex-based normalization: matches variants like "SMART Prepaid",
    // "Smart LTE", "Globe Telecom", "TNT Prepaid", etc.
    // Order matters — TNT/GOMO/Sun/DITO before Smart/Globe (sub-brands).
    const rules = [
      { match: /talk\s*n?\s*text|tnt/i, to: 'TNT' },
      { match: /gomo/i, to: 'GOMO' },
      { match: /sun/i, to: 'Sun' },
      { match: /dito/i, to: 'DITO' },
      { match: /smart/i, to: 'Smart' },
      { match: /globe/i, to: 'Globe' },
    ];
    let fixed = 0;
    for (const { match, to } of rules) {
      const filter = { carrier: { $regex: match, $nin: [to] } };

      // SignalLog and MappingSession have no unique-by-carrier index, safe to bulk update
      const r1 = await SignalLog.updateMany(filter, { $set: { carrier: to } });
      const r3 = await MappingSession.updateMany(filter, { $set: { carrier: to } });

      // ConsolidatedSignal has a unique index on (cellLat, cellLng, carrier, networkType)
      // so we must merge dirty docs into existing canonical docs when there's a collision.
      const dirtyDocs = await ConsolidatedSignal.find(filter);
      let r2Count = 0;
      for (const dirty of dirtyDocs) {
        const existing = await ConsolidatedSignal.findOne({
          cellLat: dirty.cellLat,
          cellLng: dirty.cellLng,
          carrier: to,
          networkType: dirty.networkType,
        });
        if (!existing) {
          dirty.carrier = to;
          await dirty.save();
          r2Count++;
        } else {
          // Merge: weighted avg, extreme min/max, summed count, union of readingIds, widest time range
          const totalCount = existing.count + dirty.count;
          existing.avgDbm = (existing.avgDbm * existing.count + dirty.avgDbm * dirty.count) / totalCount;
          existing.minDbm = Math.min(existing.minDbm, dirty.minDbm);
          existing.maxDbm = Math.max(existing.maxDbm, dirty.maxDbm);
          existing.count = totalCount;
          existing.firstTimestamp = new Date(Math.min(existing.firstTimestamp, dirty.firstTimestamp));
          existing.lastTimestamp = new Date(Math.max(existing.lastTimestamp, dirty.lastTimestamp));
          existing.readingIds = [...existing.readingIds, ...dirty.readingIds];
          await existing.save();
          await dirty.deleteOne();
          r2Count++;
        }
      }

      // Delete aggregated data with old carrier name (will be re-aggregated by cron)
      const r4 = await SignalHistory.deleteMany({ carrier: { $regex: match, $nin: [to] } }).catch(() => ({ deletedCount: 0 }));
      const r5 = await HeatmapTile.deleteMany({ carrier: { $regex: match, $nin: [to] } }).catch(() => ({ deletedCount: 0 }));
      fixed += (r1.modifiedCount || 0) + r2Count + (r3.modifiedCount || 0) + (r4.deletedCount || 0) + (r5.deletedCount || 0);
    }
    res.json({ status: 'ok', fixed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;
