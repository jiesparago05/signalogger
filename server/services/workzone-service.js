const WorkZone = require('../models/work-zone');
const WorkSpotReview = require('../models/work-spot-review');

async function queryByBounds(bounds) {
  return WorkZone.find({
    swLng: { $gte: bounds.sw[0] },
    swLat: { $gte: bounds.sw[1] },
    neLng: { $lte: bounds.ne[0] },
    neLat: { $lte: bounds.ne[1] },
    bestAvgDbm: { $gte: -75 },
  }).lean();
}

async function queryNearby(lng, lat, radiusMeters) {
  const radiusDeg = radiusMeters / 111000;
  return WorkZone.find({
    swLng: { $lte: lng + radiusDeg },
    neLng: { $gte: lng - radiusDeg },
    swLat: { $lte: lat + radiusDeg },
    neLat: { $gte: lat - radiusDeg },
    bestAvgDbm: { $gte: -75 },
  })
    .sort({ bestAvgDbm: -1 })
    .limit(20)
    .lean();
}

async function createReview(data) {
  return WorkSpotReview.create(data);
}

async function queryReviews(bounds) {
  return WorkSpotReview.find({
    location: {
      $geoWithin: {
        $box: [bounds.sw, bounds.ne],
      },
    },
  })
    .sort({ timestamp: -1 })
    .limit(100)
    .lean();
}

module.exports = { queryByBounds, queryNearby, createReview, queryReviews };
