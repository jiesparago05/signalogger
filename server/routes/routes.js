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
