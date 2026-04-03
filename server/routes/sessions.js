const express = require('express');
const router = express.Router();
const sessionService = require('../services/session-service');

router.post('/', async (req, res) => {
  try {
    const session = await sessionService.create(req.body);
    res.status(201).json(session);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const session = await sessionService.complete(req.params.id, req.body);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/device/:deviceId', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const skip = parseInt(req.query.skip) || 0;
    const sessions = await sessionService.listByDevice(req.params.deviceId, limit, skip);
    res.json({ data: sessions, count: sessions.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/trail', async (req, res) => {
  try {
    const trail = await sessionService.getTrail(req.params.id);
    res.json({ data: trail, count: trail.length });
  } catch (err) {
    res.status(err.message === 'Session not found' ? 404 : 500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const MappingSession = require('../models/mapping-session');
    const result = await MappingSession.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Session not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
