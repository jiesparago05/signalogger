function validateBounds(req, res, next) {
  const { sw_lng, sw_lat, ne_lng, ne_lat } = req.query;
  if (!sw_lng || !sw_lat || !ne_lng || !ne_lat) {
    return res.status(400).json({
      error: 'Missing viewport bounds. Required: sw_lng, sw_lat, ne_lng, ne_lat',
    });
  }

  const bounds = {
    sw: [parseFloat(sw_lng), parseFloat(sw_lat)],
    ne: [parseFloat(ne_lng), parseFloat(ne_lat)],
  };

  if (bounds.sw.some(isNaN) || bounds.ne.some(isNaN)) {
    return res.status(400).json({ error: 'Viewport bounds must be valid numbers' });
  }

  req.bounds = bounds;
  next();
}

function parseFilters(req, res, next) {
  req.filters = {};

  if (req.query.carrier) {
    req.filters.carrier = req.query.carrier.split(',').map((c) => c.trim());
  }

  if (req.query.networkType) {
    req.filters.networkType = req.query.networkType.split(',').map((t) => t.trim());
  }

  next();
}

module.exports = { validateBounds, parseFilters };
