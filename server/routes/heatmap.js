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
