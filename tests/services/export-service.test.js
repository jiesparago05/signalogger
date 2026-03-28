require('../setup');
const SignalLog = require('../../server/models/signal-log');
const exportService = require('../../server/services/export-service');

describe('Export Service', () => {
  const deviceId = 'export-test-device';

  beforeEach(async () => {
    await SignalLog.create([
      {
        timestamp: new Date('2026-03-01T10:00:00Z'),
        location: { type: 'Point', coordinates: [121.0, 14.5], accuracy: 10 },
        carrier: 'Smart',
        networkType: '4G',
        signal: { dbm: -67, snr: 15 },
        connection: { isWifi: false, ping: 23 },
        deviceId,
        synced: true,
      },
      {
        timestamp: new Date('2026-03-01T10:01:00Z'),
        location: { type: 'Point', coordinates: [121.1, 14.6], accuracy: 5 },
        carrier: 'Globe',
        networkType: '5G',
        signal: { dbm: -55 },
        connection: { isWifi: false, downloadSpeed: 50 },
        deviceId,
        synced: true,
      },
    ]);
  });

  test('exports as JSON', async () => {
    const result = await exportService.exportData(deviceId, 'json');
    expect(result.contentType).toBe('application/json');
    const parsed = JSON.parse(result.data);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].carrier).toBe('Smart');
  });

  test('exports as CSV', async () => {
    const result = await exportService.exportData(deviceId, 'csv');
    expect(result.contentType).toBe('text/csv');
    const lines = result.data.split('\n');
    expect(lines[0]).toContain('timestamp');
    expect(lines[0]).toContain('carrier');
    expect(lines[0]).toContain('dbm');
    expect(lines).toHaveLength(3);
  });

  test('returns empty for unknown device', async () => {
    const result = await exportService.exportData('unknown-device', 'json');
    const parsed = JSON.parse(result.data);
    expect(parsed).toHaveLength(0);
  });
});
