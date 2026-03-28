const HeatmapTile = require('../models/heatmap-tile');

async function queryTiles(bounds, zoom, filters = {}) {
  const query = {
    swLng: { $gte: bounds.sw[0] },
    swLat: { $gte: bounds.sw[1] },
    neLng: { $lte: bounds.ne[0] },
    neLat: { $lte: bounds.ne[1] },
    zoomLevel: parseInt(zoom, 10) || 12,
  };

  if (filters.carrier && filters.carrier.length > 0) {
    query.carrier = { $in: [...filters.carrier, 'all'] };
  }
  if (filters.networkType && filters.networkType.length > 0) {
    query.networkType = { $in: [...filters.networkType, 'all'] };
  }

  return HeatmapTile.find(query).lean();
}

module.exports = { queryTiles };
