const mongoose = require('mongoose');

const heatmapTileSchema = new mongoose.Schema({
  swLng: { type: Number, required: true },
  swLat: { type: Number, required: true },
  neLng: { type: Number, required: true },
  neLat: { type: Number, required: true },
  zoomLevel: {
    type: Number,
    required: true,
  },
  carrier: {
    type: String,
    required: true,
    default: 'all',
  },
  networkType: {
    type: String,
    required: true,
    default: 'all',
  },
  avgDbm: {
    type: Number,
    required: true,
  },
  dataPointCount: {
    type: Number,
    required: true,
    default: 0,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

heatmapTileSchema.index(
  { swLng: 1, swLat: 1, neLng: 1, neLat: 1, zoomLevel: 1, carrier: 1, networkType: 1 },
  { unique: true }
);
heatmapTileSchema.index({ zoomLevel: 1, carrier: 1, networkType: 1 });

module.exports = mongoose.model('HeatmapTile', heatmapTileSchema);
