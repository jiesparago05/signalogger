const mongoose = require('mongoose');

const workSpotReviewSchema = new mongoose.Schema({
  location: {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true },
  },
  deviceId: { type: String, required: true },
  carrier: { type: String, required: true },
  rating: { type: String, enum: ['strong', 'ok', 'weak', 'dead'], required: true },
  comment: { type: String, maxlength: 200 },
  timestamp: { type: Date, default: Date.now },
  synced: { type: Boolean, default: false },
});

workSpotReviewSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('WorkSpotReview', workSpotReviewSchema);
