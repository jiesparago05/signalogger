require('../setup');
const request = require('supertest');
const app = require('../../server/app');
const SignalLog = require('../../server/models/signal-log');

describe('Export API', () => {
  const deviceId = 'export-route-device';

  beforeEach(async () => {
    await SignalLog.create({
      timestamp: new Date(),
      location: { type: 'Point', coordinates: [121.0, 14.5], accuracy: 10 },
      carrier: 'Smart',
      networkType: '4G',
      signal: { dbm: -67 },
      connection: { isWifi: false },
      deviceId,
      synced: true,
    });
  });

  test('exports JSON by default', async () => {
    const res = await request(app).get(`/api/export/${deviceId}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(JSON.parse(res.text)).toHaveLength(1);
  });

  test('exports CSV when format=csv', async () => {
    const res = await request(app)
      .get(`/api/export/${deviceId}`)
      .query({ format: 'csv' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/csv/);
    expect(res.text).toContain('timestamp');
    expect(res.text).toContain('Smart');
  });

  test('returns empty array for unknown device', async () => {
    const res = await request(app).get('/api/export/unknown-device');

    expect(res.status).toBe(200);
    expect(JSON.parse(res.text)).toHaveLength(0);
  });
});
