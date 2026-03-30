const mongoose = require('mongoose');

const workZoneSchema = new mongoose.Schema({
  swLng: { type: Number, required: true },
  swLat: { type: Number, required: true },
  neLng: { type: Number, required: true },
  neLat: { type: Number, required: true },
  carriers: [{
    carrier: String,
    avgDbm: Number,
    sampleCount: Number,
    activityLevel: String,
  }],
  bestCarrier: String,
  bestAvgDbm: Number,
  lastUpdated: { type: Date, default: Date.now },
});

workZoneSchema.index({ swLng: 1, swLat: 1, neLng: 1, neLat: 1 }, { unique: true });

module.exports = mongoose.model('WorkZone', workZoneSchema);
