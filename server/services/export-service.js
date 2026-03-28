const SignalLog = require('../models/signal-log');

async function exportData(deviceId, format) {
  const logs = await SignalLog.find({ deviceId })
    .sort({ timestamp: 1 })
    .lean();

  if (format === 'csv') {
    return {
      contentType: 'text/csv',
      data: toCsv(logs),
      filename: `signalog-${deviceId}.csv`,
    };
  }

  return {
    contentType: 'application/json',
    data: JSON.stringify(logs),
    filename: `signalog-${deviceId}.json`,
  };
}

function toCsv(logs) {
  const headers = [
    'timestamp',
    'latitude',
    'longitude',
    'accuracy',
    'carrier',
    'networkType',
    'dbm',
    'rssi',
    'snr',
    'cellId',
    'bandFrequency',
    'downloadSpeed',
    'uploadSpeed',
    'ping',
    'isWifi',
  ];

  const rows = logs.map((log) =>
    [
      log.timestamp ? new Date(log.timestamp).toISOString() : '',
      log.location?.coordinates?.[1] ?? '',
      log.location?.coordinates?.[0] ?? '',
      log.location?.accuracy ?? '',
      log.carrier ?? '',
      log.networkType ?? '',
      log.signal?.dbm ?? '',
      log.signal?.rssi ?? '',
      log.signal?.snr ?? '',
      log.signal?.cellId ?? '',
      log.signal?.bandFrequency ?? '',
      log.connection?.downloadSpeed ?? '',
      log.connection?.uploadSpeed ?? '',
      log.connection?.ping ?? '',
      log.connection?.isWifi ?? '',
    ].join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

module.exports = { exportData };
