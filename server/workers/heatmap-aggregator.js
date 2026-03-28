const cron = require('node-cron');
const SignalLog = require('../models/signal-log');
const HeatmapTile = require('../models/heatmap-tile');
const config = require('../config');

const TILE_SIZE = {
  10: 0.1,
  12: 0.01,
  14: 0.005,
};
const ZOOM_LEVELS = [10, 12, 14];

async function aggregate() {
  for (const zoom of ZOOM_LEVELS) {
    const tileSize = TILE_SIZE[zoom];

    // Per-carrier tiles
    const pipeline = [
      {
        $group: {
          _id: {
            tileLng: {
              $multiply: [
                { $floor: { $divide: [{ $arrayElemAt: ['$location.coordinates', 0] }, tileSize] } },
                tileSize,
              ],
            },
            tileLat: {
              $multiply: [
                { $floor: { $divide: [{ $arrayElemAt: ['$location.coordinates', 1] }, tileSize] } },
                tileSize,
              ],
            },
            carrier: '$carrier',
            networkType: '$networkType',
          },
          avgDbm: { $avg: '$signal.dbm' },
          count: { $sum: 1 },
        },
      },
    ];

    const results = await SignalLog.aggregate(pipeline);

    for (const result of results) {
      const swLng = parseFloat(result._id.tileLng.toFixed(6));
      const swLat = parseFloat(result._id.tileLat.toFixed(6));
      const neLng = parseFloat((result._id.tileLng + tileSize).toFixed(6));
      const neLat = parseFloat((result._id.tileLat + tileSize).toFixed(6));

      await HeatmapTile.findOneAndUpdate(
        {
          swLng, swLat, neLng, neLat,
          zoomLevel: zoom,
          carrier: result._id.carrier,
          networkType: result._id.networkType,
        },
        {
          avgDbm: Math.round(result.avgDbm),
          dataPointCount: result.count,
          lastUpdated: new Date(),
        },
        { upsert: true }
      );
    }

    // "all" carrier tiles
    const allPipeline = [
      {
        $group: {
          _id: {
            tileLng: {
              $multiply: [
                { $floor: { $divide: [{ $arrayElemAt: ['$location.coordinates', 0] }, tileSize] } },
                tileSize,
              ],
            },
            tileLat: {
              $multiply: [
                { $floor: { $divide: [{ $arrayElemAt: ['$location.coordinates', 1] }, tileSize] } },
                tileSize,
              ],
            },
          },
          avgDbm: { $avg: '$signal.dbm' },
          count: { $sum: 1 },
        },
      },
    ];

    const allResults = await SignalLog.aggregate(allPipeline);

    for (const result of allResults) {
      const swLng = parseFloat(result._id.tileLng.toFixed(6));
      const swLat = parseFloat(result._id.tileLat.toFixed(6));
      const neLng = parseFloat((result._id.tileLng + tileSize).toFixed(6));
      const neLat = parseFloat((result._id.tileLat + tileSize).toFixed(6));

      await HeatmapTile.findOneAndUpdate(
        {
          swLng, swLat, neLng, neLat,
          zoomLevel: zoom,
          carrier: 'all',
          networkType: 'all',
        },
        {
          avgDbm: Math.round(result.avgDbm),
          dataPointCount: result.count,
          lastUpdated: new Date(),
        },
        { upsert: true }
      );
    }
  }

  console.log(`[Heatmap Aggregator] Completed at ${new Date().toISOString()}`);
}

function start() {
  console.log(`[Heatmap Aggregator] Scheduled: ${config.heatmapCronInterval}`);
  cron.schedule(config.heatmapCronInterval, aggregate);
}

module.exports = { start, aggregate };
