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

module.exports = app;
