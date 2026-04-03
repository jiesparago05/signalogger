// server/models/consolidated-signal.js
const mongoose = require('mongoose');

const consolidatedSignalSchema = new mongoose.Schema({
  location: {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true },
  },
  carrier: { type: String, required: true, index: true },
  networkType: { type: String, required: true, index: true },
  avgDbm: { type: Number, required: true },
  minDbm: { type: Number, required: true },
  maxDbm: { type: Number, required: true },
  count: { type: Number, required: true },
  firstTimestamp: { type: Date, required: true },
  lastTimestamp: { type: Date, required: true },
  readingIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SignalLog' }],
  cellLat: { type: Number, required: true },
  cellLng: { type: Number, required: true },
});

consolidatedSignalSchema.index({ location: '2dsphere' });
consolidatedSignalSchema.index({ cellLat: 1, cellLng: 1, carrier: 1, networkType: 1 }, { unique: true });

module.exports = mongoose.model('ConsolidatedSignal', consolidatedSignalSchema);
