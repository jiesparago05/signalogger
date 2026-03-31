const MappingSession = require('../models/mapping-session');
const SignalLog = require('../models/signal-log');

async function reverseGeocode(lng, lat) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=14`,
      { headers: { 'User-Agent': 'Signalog/1.0' } },
    );
    const data = await res.json();
    const parts = (data.display_name || '').split(',');
    return parts.slice(0, 2).map(s => s.trim()).join(', ');
  } catch {
    return null;
  }
}

async function create(data) {
  return MappingSession.create(data);
}

async function complete(sessionId, stats) {
  const session = await MappingSession.findByIdAndUpdate(
    sessionId,
    { ...stats, status: 'completed' },
    { new: true },
  );

  // Reverse geocode start/end in background (don't block response)
  if (session) {
    (async () => {
      const updates = {};
      if (session.startLocation?.coordinates) {
        const [lng, lat] = session.startLocation.coordinates;
        const name = await reverseGeocode(lng, lat);
        if (name) updates.startLocationName = name;
      }
      if (session.endLocation?.coordinates) {
        const [lng, lat] = session.endLocation.coordinates;
        const name = await reverseGeocode(lng, lat);
        if (name) updates.endLocationName = name;
      }
      if (Object.keys(updates).length > 0) {
        await MappingSession.findByIdAndUpdate(sessionId, updates);
      }
    })().catch(err => console.warn('Geocode failed:', err));
  }

  return session;
}

async function listByDevice(deviceId, limit = 20, skip = 0) {
  return MappingSession.find({ deviceId, status: 'completed' })
    .sort({ startTime: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
}

async function getTrail(sessionId) {
  const session = await MappingSession.findById(sessionId).lean();
  if (!session) throw new Error('Session not found');

  const query = {
    deviceId: session.deviceId,
    timestamp: { $gte: session.startTime },
  };
  if (session.endTime) {
    query.timestamp.$lte = session.endTime;
  }

  return SignalLog.find(query)
    .sort({ timestamp: 1 })
    .select('timestamp location signal.dbm carrier networkType')
    .lean();
}

module.exports = { create, complete, listByDevice, getTrail };
