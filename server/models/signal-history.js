const mongoose = require('mongoose');

const signalHistorySchema = new mongoose.Schema({
  swLng: { type: Number, required: true },
  swLat: { type: Number, required: true },
  neLng: { type: Number, required: true },
  neLat: { type: Number, required: true },
  carrier: { type: String, required: true },
  networkType: { type: String, required: true },
  hour: { type: Date, required: true },
  avgDbm: Number,
  minDbm: Number,
  maxDbm: Number,
  sampleCount: Number,
});

signalHistorySchema.index(
  { swLng: 1, swLat: 1, neLng: 1, neLat: 1, carrier: 1, networkType: 1, hour: 1 },
  { unique: true },
);

module.exports = mongoose.model('SignalHistory', signalHistorySchema);
