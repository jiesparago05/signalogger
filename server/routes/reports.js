const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const config = require('../config');
const { validateBounds, parseFilters } = require('../middleware/validate');
const reportService = require('../services/report-service');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(
      file.originalname
    )}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'audio/mp4',
      'audio/m4a',
      'audio/mpeg',
      'audio/wav',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

router.post('/', async (req, res) => {
  try {
    const report = await reportService.createReport(req.body);
    res.status(201).json(report);
  } catch (err) {
    if (err.message.includes('Invalid category')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to create report' });
  }
});

router.get('/', validateBounds, parseFilters, async (req, res) => {
  try {
    const reports = await reportService.queryByViewport(req.bounds, req.filters);
    res.json({ data: reports, count: reports.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to query reports' });
  }
});

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    if (!req.body.reportId) {
      return res.status(400).json({ error: 'reportId is required' });
    }

    const fileType = req.file.mimetype.startsWith('image/') ? 'photo' : 'voice_note';
    const attachment = {
      type: fileType,
      url: `/uploads/${req.file.filename}`,
      size: req.file.size,
    };

    const report = await reportService.addAttachment(req.body.reportId, attachment);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.status(201).json(attachment);
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

module.exports = router;
