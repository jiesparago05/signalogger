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
    const map = { 'SMART': 'Smart', 'GLOBE': 'Globe', 'SUN': 'Sun', 'smart': 'Smart', 'globe': 'Globe' };
    let fixed = 0;
    for (const [from, to] of Object.entries(map)) {
      const r1 = await SignalLog.updateMany({ carrier: from }, { $set: { carrier: to } });
      const r2 = await ConsolidatedSignal.updateMany({ carrier: from }, { $set: { carrier: to } });
      const r3 = await MappingSession.updateMany({ carrier: from }, { $set: { carrier: to } });
      // Delete aggregated data with old carrier name (will be re-aggregated by cron)
      const r4 = await SignalHistory.deleteMany({ carrier: from }).catch(() => ({ deletedCount: 0 }));
      const r5 = await HeatmapTile.deleteMany({ carrier: from }).catch(() => ({ deletedCount: 0 }));
      fixed += (r1.modifiedCount || 0) + (r2.modifiedCount || 0) + (r3.modifiedCount || 0) + (r4.deletedCount || 0) + (r5.deletedCount || 0);
    }
    res.json({ status: 'ok', fixed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;
