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

  // --- Signal History (hourly averages) ---
  const SignalHistory = require('../models/signal-history');
  const historyTileSize = 0.01;

  const historyPipeline = [
    {
      $group: {
        _id: {
          tileLng: {
            $multiply: [
              { $floor: { $divide: [{ $arrayElemAt: ['$location.coordinates', 0] }, historyTileSize] } },
              historyTileSize,
            ],
          },
          tileLat: {
            $multiply: [
              { $floor: { $divide: [{ $arrayElemAt: ['$location.coordinates', 1] }, historyTileSize] } },
              historyTileSize,
            ],
          },
          carrier: '$carrier',
          networkType: '$networkType',
          hour: {
            $dateTrunc: { date: '$timestamp', unit: 'hour' },
          },
        },
        avgDbm: { $avg: '$signal.dbm' },
        minDbm: { $min: '$signal.dbm' },
        maxDbm: { $max: '$signal.dbm' },
        count: { $sum: 1 },
      },
    },
  ];

  const historyResults = await SignalLog.aggregate(historyPipeline);

  for (const r of historyResults) {
    const swLng = parseFloat(r._id.tileLng.toFixed(6));
    const swLat = parseFloat(r._id.tileLat.toFixed(6));

    await SignalHistory.findOneAndUpdate(
      {
        swLng, swLat,
        neLng: parseFloat((r._id.tileLng + historyTileSize).toFixed(6)),
        neLat: parseFloat((r._id.tileLat + historyTileSize).toFixed(6)),
        carrier: r._id.carrier,
        networkType: r._id.networkType,
        hour: r._id.hour,
      },
      {
        avgDbm: Math.round(r.avgDbm),
        minDbm: r.minDbm,
        maxDbm: r.maxDbm,
        sampleCount: r.count,
      },
      { upsert: true },
    );
  }

  // --- Work Zones (areas with strong signal) ---
  const WorkZone = require('../models/work-zone');

  const workZonePipeline = [
    {
      $group: {
        _id: {
          tileLng: {
            $multiply: [
              { $floor: { $divide: [{ $arrayElemAt: ['$location.coordinates', 0] }, historyTileSize] } },
              historyTileSize,
            ],
          },
          tileLat: {
            $multiply: [
              { $floor: { $divide: [{ $arrayElemAt: ['$location.coordinates', 1] }, historyTileSize] } },
              historyTileSize,
            ],
          },
          carrier: '$carrier',
        },
        avgDbm: { $avg: '$signal.dbm' },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gte: 10 } } },
  ];

  const wzResults = await SignalLog.aggregate(workZonePipeline);

  const wzMap = {};
  for (const r of wzResults) {
    const key = `${r._id.tileLng}_${r._id.tileLat}`;
    if (!wzMap[key]) wzMap[key] = { tileLng: r._id.tileLng, tileLat: r._id.tileLat, carriers: [] };

    let activityLevel = 'dead';
    if (r.avgDbm >= -75) activityLevel = 'gaming';
    else if (r.avgDbm >= -85) activityLevel = 'streaming';
    else if (r.avgDbm >= -95) activityLevel = 'browsing';
    else if (r.avgDbm >= -105) activityLevel = 'messaging';

    wzMap[key].carriers.push({
      carrier: r._id.carrier,
      avgDbm: Math.round(r.avgDbm),
      sampleCount: r.count,
      activityLevel,
    });
  }

  for (const wz of Object.values(wzMap)) {
    const best = wz.carriers.reduce((a, b) => a.avgDbm > b.avgDbm ? a : b);
    const swLng = parseFloat(wz.tileLng.toFixed(6));
    const swLat = parseFloat(wz.tileLat.toFixed(6));

    await WorkZone.findOneAndUpdate(
      {
        swLng, swLat,
        neLng: parseFloat((wz.tileLng + historyTileSize).toFixed(6)),
        neLat: parseFloat((wz.tileLat + historyTileSize).toFixed(6)),
      },
      {
        carriers: wz.carriers,
        bestCarrier: best.carrier,
        bestAvgDbm: best.avgDbm,
        lastUpdated: new Date(),
      },
      { upsert: true },
    );
  }

  console.log(`[Heatmap Aggregator] Completed at ${new Date().toISOString()}`);
}

function start() {
  console.log(`[Heatmap Aggregator] Scheduled: ${config.heatmapCronInterval}`);
  cron.schedule(config.heatmapCronInterval, aggregate);
}

module.exports = { start, aggregate };
