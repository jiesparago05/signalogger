const mongoose = require('mongoose');

const manualReportSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
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
  },
  carrier: {
    type: String,
    required: true,
  },
  networkType: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
    enum: ['dead_zone', 'weak_signal', 'intermittent', 'slow_data'],
  },
  note: {
    type: String,
    maxlength: 500,
  },
  attachments: [
    {
      type: {
        type: String,
        enum: ['photo', 'voice_note'],
      },
      url: String,
      size: Number,
    },
  ],
  deviceId: {
    type: String,
    required: true,
  },
  synced: {
    type: Boolean,
    default: false,
  },
});

manualReportSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('ManualReport', manualReportSchema);
