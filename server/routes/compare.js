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
