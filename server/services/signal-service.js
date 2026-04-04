const SignalLog = require('../models/signal-log');
const ConsolidatedSignal = require('../models/consolidated-signal');

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
  const geoQuery = {
    location: {
      $geoWithin: {
        $box: [bounds.sw, bounds.ne],
      },
    },
  };

  const carrierFilter = {};
  if (filters.carrier && filters.carrier.length > 0) {
    carrierFilter.carrier = { $in: filters.carrier.map((c) => new RegExp(`^${c}$`, 'i')) };
  }
  if (filters.networkType && filters.networkType.length > 0) {
    carrierFilter.networkType = { $in: filters.networkType };
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Fresh signals (< 24h, not consolidated)
  const freshQuery = {
    ...geoQuery,
    ...carrierFilter,
    timestamp: { $gte: cutoff },
  };
  const fresh = await SignalLog.find(freshQuery).sort({ timestamp: -1 }).limit(200).lean();

  // Consolidated signals
  const consolidatedQuery = {
    ...geoQuery,
    ...carrierFilter,
  };
  const consolidated = await ConsolidatedSignal.find(consolidatedQuery).limit(300).lean();

  return { fresh, consolidated };
}

async function getReadingsByIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('ids must be a non-empty array');
  }
  if (ids.length > 100) {
    throw new Error('Cannot fetch more than 100 readings at once');
  }
  const ObjectId = require('mongoose').Types.ObjectId;
  const objectIds = ids.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id));
  return SignalLog.find({ _id: { $in: objectIds } })
    .sort({ timestamp: -1 })
    .lean();
}

module.exports = { createBatch, queryByViewport, getReadingsByIds };
