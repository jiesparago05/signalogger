const SignalHistory = require('../models/signal-history');

async function queryByLocation(lng, lat, radiusMeters, days, carrier) {
  const radiusDeg = radiusMeters / 111000;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const query = {
    swLng: { $lte: lng + radiusDeg },
    neLng: { $gte: lng - radiusDeg },
    swLat: { $lte: lat + radiusDeg },
    neLat: { $gte: lat - radiusDeg },
    hour: { $gte: since },
  };

  if (carrier) query.carrier = carrier;

  const results = await SignalHistory.aggregate([
    { $match: query },
    {
      $group: {
        _id: { carrier: '$carrier' },
        avgDbm: { $avg: '$avgDbm' },
        sampleCount: { $sum: '$sampleCount' },
      },
    },
    { $sort: { avgDbm: -1 } },
  ]);

  return results.map((r) => ({
    carrier: r._id.carrier,
    avgDbm: Math.round(r.avgDbm),
    sampleCount: r.sampleCount,
  }));
}

module.exports = { queryByLocation };
