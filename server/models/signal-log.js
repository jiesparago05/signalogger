const mongoose = require('mongoose');

const signalLogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
    },
    accuracy: Number,
    altitude: Number,
  },
  carrier: {
    type: String,
    required: true,
    index: true,
  },
  networkType: {
    type: String,
    required: true,
    index: true,
  },
  signal: {
    dbm: { type: Number, required: true },
    rssi: Number,
    snr: Number,
    cellId: String,
    bandFrequency: Number,
    // Phase 1 real-connectivity capture — see docs/superpowers/plans/2026-04-10-phase1-*.md
    // All optional; old clients omit them and render as undefined on the frontend.
    validated: Boolean,    // Android NET_CAPABILITY_VALIDATED (probabilistic)
    downKbps: Number,      // LinkDownstreamBandwidthKbps estimate (0 = unknown)
    upKbps: Number,        // LinkUpstreamBandwidthKbps estimate (0 = unknown)
    dataState: String,     // connected | suspended | disconnected | connecting | unknown
  },
  connection: {
    downloadSpeed: Number,
    uploadSpeed: Number,
    ping: Number,
    isWifi: { type: Boolean, required: true },
  },
  deviceId: {
    type: String,
    required: true,
    index: true,
  },
  synced: {
    type: Boolean,
    default: false,
  },
  consolidated: {
    type: Boolean,
    default: false,
    index: true,
  },
});

signalLogSchema.index({ location: '2dsphere' });
signalLogSchema.index({ carrier: 1, networkType: 1 });
signalLogSchema.index({ deviceId: 1, synced: 1 });

module.exports = mongoose.model('SignalLog', signalLogSchema);
