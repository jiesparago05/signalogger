const express = require('express');
const router = express.Router();
const exportService = require('../services/export-service');

router.get('/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const format = req.query.format || 'json';
    const result = await exportService.exportData(deviceId, format);

    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`
    );
    res.send(result.data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to export data' });
  }
});

module.exports = router;
