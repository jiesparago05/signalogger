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
