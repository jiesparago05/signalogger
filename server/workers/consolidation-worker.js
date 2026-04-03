// server/workers/consolidation-worker.js
const cron = require('node-cron');
const SignalLog = require('../models/signal-log');
const ConsolidatedSignal = require('../models/consolidated-signal');

const CELL_SIZE = 0.0005; // ~50 meters

function toCell(val) {
  return Math.round(val / CELL_SIZE) * CELL_SIZE;
}

async function consolidate() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const pipeline = [
    {
      $match: {
        timestamp: { $lt: cutoff },
        consolidated: { $ne: true },
        'connection.isWifi': { $ne: true },
      },
    },
    {
      $addFields: {
        cellLng: {
          $multiply: [
            { $round: [{ $divide: [{ $arrayElemAt: ['$location.coordinates', 0] }, CELL_SIZE] }, 0] },
            CELL_SIZE,
          ],
        },
        cellLat: {
          $multiply: [
            { $round: [{ $divide: [{ $arrayElemAt: ['$location.coordinates', 1] }, CELL_SIZE] }, 0] },
            CELL_SIZE,
          ],
        },
      },
    },
    {
      $group: {
        _id: {
          cellLng: '$cellLng',
          cellLat: '$cellLat',
          carrier: '$carrier',
          networkType: '$networkType',
        },
        avgDbm: { $avg: '$signal.dbm' },
        minDbm: { $min: '$signal.dbm' },
        maxDbm: { $max: '$signal.dbm' },
        count: { $sum: 1 },
        firstTimestamp: { $min: '$timestamp' },
        lastTimestamp: { $max: '$timestamp' },
        readingIds: { $push: '$_id' },
        avgLng: { $avg: { $arrayElemAt: ['$location.coordinates', 0] } },
        avgLat: { $avg: { $arrayElemAt: ['$location.coordinates', 1] } },
      },
    },
    {
      $match: { count: { $gte: 2 } },
    },
  ];

  const groups = await SignalLog.aggregate(pipeline);
  let created = 0;

  for (const g of groups) {
    await ConsolidatedSignal.findOneAndUpdate(
      {
        cellLat: parseFloat(g._id.cellLat.toFixed(6)),
        cellLng: parseFloat(g._id.cellLng.toFixed(6)),
        carrier: g._id.carrier,
        networkType: g._id.networkType,
      },
      {
        location: {
          type: 'Point',
          coordinates: [parseFloat(g.avgLng.toFixed(6)), parseFloat(g.avgLat.toFixed(6))],
        },
        avgDbm: Math.round(g.avgDbm),
        minDbm: g.minDbm,
        maxDbm: g.maxDbm,
        count: g.count,
        firstTimestamp: g.firstTimestamp,
        lastTimestamp: g.lastTimestamp,
        readingIds: g.readingIds.slice(0, 100),
      },
      { upsert: true },
    );

    // Mark original readings as consolidated
    await SignalLog.updateMany(
      { _id: { $in: g.readingIds } },
      { $set: { consolidated: true } },
    );

    created++;
  }

  console.log(`[Consolidation] ${created} groups consolidated at ${new Date().toISOString()}`);
}

function start() {
  console.log('[Consolidation] Scheduled: every hour');
  cron.schedule('0 * * * *', consolidate);
}

module.exports = { start, consolidate };
