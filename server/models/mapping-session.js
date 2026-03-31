const mongoose = require('mongoose');

const mappingSessionSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, index: true },
  startTime: { type: Date, required: true },
  endTime: Date,
  startLocation: {
    type: { type: String, enum: ['Point'] },
    coordinates: [Number],
  },
  endLocation: {
    type: { type: String, enum: ['Point'] },
    coordinates: [Number],
  },
  startLocationName: String,
  endLocationName: String,
  logCount: { type: Number, default: 0 },
  avgDbm: Number,
  minDbm: Number,
  maxDbm: Number,
  carrier: String,
  networkType: String,
  distanceMeters: { type: Number, default: 0 },
  stability: { type: String, enum: ['Stable', 'Fluctuating', 'Unstable'] },
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommuteRoute' },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  synced: { type: Boolean, default: false },
});

mappingSessionSchema.index({ deviceId: 1, startTime: -1 });

module.exports = mongoose.model('MappingSession', mappingSessionSchema);
