const express = require('express');
const router = express.Router();
const { validateBounds } = require('../middleware/validate');
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
