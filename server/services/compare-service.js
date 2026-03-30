const SignalHistory = require('../models/signal-history');
const CommuteRoute = require('../models/commute-route');

function getActivityLevel(avgDbm) {
  if (avgDbm >= -75) return 'gaming';
  if (avgDbm >= -85) return 'streaming';
  if (avgDbm >= -95) return 'browsing';
  if (avgDbm >= -105) return 'messaging';
  return 'dead';
}

async function compareRoute(routeId) {
  const route = await CommuteRoute.findById(routeId).lean();
  if (!route) throw new Error('Route not found');

  const bufferDeg = 0.01;
  const segments = [];
  const carrierTotals = {};

  for (const seg of route.segments) {
    const centerLng = (seg.startLocation.coordinates[0] + seg.endLocation.coordinates[0]) / 2;
    const centerLat = (seg.startLocation.coordinates[1] + seg.endLocation.coordinates[1]) / 2;

    const tiles = await SignalHistory.aggregate([
      {
        $match: {
          swLng: { $lte: centerLng + bufferDeg },
          neLng: { $gte: centerLng - bufferDeg },
          swLat: { $lte: centerLat + bufferDeg },
          neLat: { $gte: centerLat - bufferDeg },
        },
      },
      {
        $group: {
          _id: '$carrier',
          avgDbm: { $avg: '$avgDbm' },
          sampleCount: { $sum: '$sampleCount' },
        },
      },
      { $sort: { avgDbm: -1 } },
    ]);

    const carriers = tiles.map((t) => {
      const avgDbm = Math.round(t.avgDbm);
      if (!carrierTotals[t._id]) carrierTotals[t._id] = { sum: 0, count: 0, samples: 0 };
      carrierTotals[t._id].sum += t.avgDbm;
      carrierTotals[t._id].count += 1;
      carrierTotals[t._id].samples += t.sampleCount;
      return { carrier: t._id, avgDbm, activityLevel: getActivityLevel(avgDbm) };
    });

    segments.push({ label: seg.label, distanceMeters: seg.distanceMeters, carriers });
  }

  const ranking = Object.entries(carrierTotals)
    .map(([carrier, data]) => {
      const avgDbm = Math.round(data.sum / data.count);
      return { carrier, avgDbm, activityLevel: getActivityLevel(avgDbm), sampleCount: data.samples };
    })
    .sort((a, b) => b.avgDbm - a.avgDbm);

  const totalDataPoints = ranking.reduce((s, r) => s + r.sampleCount, 0);
  return { ranking, segments, totalDataPoints };
}

async function compareLocation(lng, lat, radiusMeters, days) {
  const radiusDeg = radiusMeters / 111000;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const results = await SignalHistory.aggregate([
    {
      $match: {
        swLng: { $lte: lng + radiusDeg },
        neLng: { $gte: lng - radiusDeg },
        swLat: { $lte: lat + radiusDeg },
        neLat: { $gte: lat - radiusDeg },
        hour: { $gte: since },
      },
    },
    {
      $group: {
        _id: '$carrier',
        avgDbm: { $avg: '$avgDbm' },
        sampleCount: { $sum: '$sampleCount' },
      },
    },
    { $sort: { avgDbm: -1 } },
  ]);

  return results.map((r) => {
    const avgDbm = Math.round(r.avgDbm);
    return { carrier: r._id, avgDbm, activityLevel: getActivityLevel(avgDbm), sampleCount: r.sampleCount };
  });
}

module.exports = { compareRoute, compareLocation };
