const SignalLog = require('../models/signal-log');

async function createBatch(signals) {
  if (!Array.isArray(signals) || signals.length === 0) {
    throw new Error('signals must be a non-empty array');
  }
  if (signals.length > 100) {
    throw new Error('Batch size cannot exceed 100');
  }
  return SignalLog.insertMany(signals);
}

async function queryByViewport(bounds, filters = {}) {
  const query = {
    location: {
      $geoWithin: {
        $box: [bounds.sw, bounds.ne],
      },
    },
  };

  if (filters.carrier && filters.carrier.length > 0) {
    query.carrier = { $in: filters.carrier };
  }
  if (filters.networkType && filters.networkType.length > 0) {
    query.networkType = { $in: filters.networkType };
  }

  return SignalLog.find(query).sort({ timestamp: -1 }).limit(500).lean();
}

module.exports = { createBatch, queryByViewport };
