const MappingSession = require('../models/mapping-session');
const SignalLog = require('../models/signal-log');

async function create(data) {
  return MappingSession.create(data);
}

async function complete(sessionId, stats) {
  return MappingSession.findByIdAndUpdate(
    sessionId,
    { ...stats, status: 'completed' },
    { new: true },
  );
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
