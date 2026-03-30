const mongoose = require('mongoose');

const segmentSchema = new mongoose.Schema({
  startLocation: {
    type: { type: String, enum: ['Point'] },
    coordinates: [Number],
  },
  endLocation: {
    type: { type: String, enum: ['Point'] },
    coordinates: [Number],
  },
  label: String,
  distanceMeters: Number,
  avgDbm: Number,
  minDbm: Number,
  maxDbm: Number,
  sampleCount: Number,
  activityLevel: String,
}, { _id: false });

const commuteRouteSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  sessions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MappingSession' }],
  segments: [segmentSchema],
  overallGrade: String,
  totalTrips: { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('CommuteRoute', commuteRouteSchema);
