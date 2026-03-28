require('../setup');
const SignalLog = require('../../server/models/signal-log');

describe('SignalLog Model', () => {
  const validLog = {
    timestamp: new Date(),
    location: {
      type: 'Point',
      coordinates: [121.0, 14.5],
      accuracy: 10,
    },
    carrier: 'Smart',
    networkType: '4G',
    signal: {
      dbm: -67,
    },
    connection: {
      isWifi: false,
    },
    deviceId: 'test-device-001',
    synced: false,
  };

  test('creates a valid signal log', async () => {
    const log = await SignalLog.create(validLog);
    expect(log._id).toBeDefined();
    expect(log.carrier).toBe('Smart');
    expect(log.signal.dbm).toBe(-67);
    expect(log.location.coordinates).toEqual([121.0, 14.5]);
  });

  test('requires carrier field', async () => {
    const { carrier, ...noCarrier } = validLog;
    await expect(SignalLog.create(noCarrier)).rejects.toThrow(/carrier/i);
  });

  test('requires networkType field', async () => {
    const { networkType, ...noType } = validLog;
    await expect(SignalLog.create(noType)).rejects.toThrow(/networkType/i);
  });

  test('requires location field', async () => {
    const { location, ...noLocation } = validLog;
    await expect(SignalLog.create(noLocation)).rejects.toThrow();
  });

  test('requires deviceId field', async () => {
    const { deviceId, ...noDevice } = validLog;
    await expect(SignalLog.create(noDevice)).rejects.toThrow(/deviceId/i);
  });

  test('allows optional signal fields', async () => {
    const log = await SignalLog.create({
      ...validLog,
      signal: {
        dbm: -67,
        rssi: -70,
        snr: 15.5,
        cellId: 'cell-123',
        bandFrequency: 1800,
      },
    });
    expect(log.signal.rssi).toBe(-70);
    expect(log.signal.snr).toBe(15.5);
    expect(log.signal.cellId).toBe('cell-123');
    expect(log.signal.bandFrequency).toBe(1800);
  });

  test('allows optional connection fields', async () => {
    const log = await SignalLog.create({
      ...validLog,
      connection: {
        downloadSpeed: 25.5,
        uploadSpeed: 10.2,
        ping: 23,
        isWifi: false,
      },
    });
    expect(log.connection.downloadSpeed).toBe(25.5);
    expect(log.connection.ping).toBe(23);
  });

  test('supports geospatial query with 2dsphere index', async () => {
    await SignalLog.create(validLog);
    await SignalLog.create({
      ...validLog,
      location: { type: 'Point', coordinates: [122.0, 15.0], accuracy: 5 },
    });

    const results = await SignalLog.find({
      location: {
        $geoWithin: {
          $box: [
            [120.5, 14.0],
            [121.5, 15.0],
          ],
        },
      },
    });
    expect(results).toHaveLength(1);
    expect(results[0].location.coordinates).toEqual([121.0, 14.5]);
  });
});
