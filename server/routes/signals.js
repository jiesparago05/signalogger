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

module.exports = router;
