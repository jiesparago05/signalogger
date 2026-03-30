const CommuteRoute = require('../models/commute-route');
const SignalLog = require('../models/signal-log');
const MappingSession = require('../models/mapping-session');

function distanceBetween(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getActivityLevel(avgDbm) {
  if (avgDbm >= -75) return 'gaming';
  if (avgDbm >= -85) return 'streaming';
  if (avgDbm >= -95) return 'browsing';
  if (avgDbm >= -105) return 'messaging';
  return 'dead';
}

function getGrade(segments) {
  if (segments.length === 0) return 'N/A';
  const avg = segments.reduce((s, seg) => s + seg.avgDbm, 0) / segments.length;
  if (avg >= -70) return 'A';
  if (avg >= -80) return 'B';
  if (avg >= -90) return 'C';
  if (avg >= -100) return 'D';
  return 'F';
}

async function computeSegments(sessionIds) {
  const sessions = await MappingSession.find({ _id: { $in: sessionIds } }).lean();
  if (sessions.length === 0) return [];

  const allLogs = [];
  for (const session of sessions) {
    const query = {
      deviceId: session.deviceId,
      timestamp: { $gte: session.startTime },
    };
    if (session.endTime) query.timestamp.$lte = session.endTime;
    const logs = await SignalLog.find(query).sort({ timestamp: 1 }).lean();
    allLogs.push(...logs);
  }

  if (allLogs.length === 0) return [];

  allLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const segments = [];
  let segStart = 0;
  let segDistance = 0;
  let segIndex = 0;

  for (let i = 1; i < allLogs.length; i++) {
    const prev = allLogs[i - 1];
    const curr = allLogs[i];
    const d = distanceBetween(
      prev.location.coordinates[1], prev.location.coordinates[0],
      curr.location.coordinates[1], curr.location.coordinates[0],
    );
    segDistance += d;

    if (segDistance >= 1000 || i === allLogs.length - 1) {
      const segLogs = allLogs.slice(segStart, i + 1);
      const dbms = segLogs.map(l => l.signal.dbm);
      const avgDbm = Math.round(dbms.reduce((s, v) => s + v, 0) / dbms.length);

      segments.push({
        startLocation: {
          type: 'Point',
          coordinates: allLogs[segStart].location.coordinates,
        },
        endLocation: {
          type: 'Point',
          coordinates: curr.location.coordinates,
        },
        label: `KM ${segIndex}-${segIndex + 1}`,
        distanceMeters: Math.round(segDistance),
        avgDbm,
        minDbm: Math.min(...dbms),
        maxDbm: Math.max(...dbms),
        sampleCount: segLogs.length,
        activityLevel: getActivityLevel(avgDbm),
      });

      segStart = i;
      segDistance = 0;
      segIndex++;
    }
  }

  return segments;
}

async function create(data) {
  const segments = await computeSegments(data.sessions || []);
  const route = await CommuteRoute.create({
    ...data,
    segments,
    overallGrade: getGrade(segments),
    totalTrips: 1,
  });
  if (data.sessions && data.sessions.length > 0) {
    await MappingSession.updateMany(
      { _id: { $in: data.sessions } },
      { routeId: route._id },
    );
  }
  return route;
}

async function addSession(routeId, sessionId) {
  const route = await CommuteRoute.findById(routeId);
  if (!route) throw new Error('Route not found');

  route.sessions.push(sessionId);
  route.totalTrips = route.sessions.length;

  const segments = await computeSegments(route.sessions);
  route.segments = segments;
  route.overallGrade = getGrade(segments);
  route.updatedAt = new Date();

  await route.save();
  await MappingSession.findByIdAndUpdate(sessionId, { routeId });
  return route;
}

async function listByDevice(deviceId) {
  return CommuteRoute.find({ deviceId }).sort({ updatedAt: -1 }).lean();
}

async function getById(routeId) {
  return CommuteRoute.findById(routeId).lean();
}

module.exports = { create, addSession, listByDevice, getById };
