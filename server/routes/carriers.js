const express = require('express');
const router = express.Router();
const config = require('../config');

router.get('/', (req, res) => {
  res.json({
    carriers: config.carriers,
    networkTypes: config.networkTypes,
    reportCategories: config.reportCategories,
  });
});

module.exports = router;
