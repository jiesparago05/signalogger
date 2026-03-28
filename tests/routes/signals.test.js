require('../setup');
const request = require('supertest');
const app = require('../../server/app');
const SignalLog = require('../../server/models/signal-log');

describe('Signals API', () => {
  const validSignal = {
    timestamp: new Date().toISOString(),
    location: {
      type: 'Point',
      coordinates: [121.0, 14.5],
      accuracy: 10,
    },
    carrier: 'Smart',
    networkType: '4G',
    signal: { dbm: -67 },
    connection: { isWifi: false },
    deviceId: 'test-device-001',
    synced: false,
  };

  describe('POST /api/signals/batch', () => {
    test('inserts a batch of signal logs', async () => {
      const res = await request(app)
        .post('/api/signals/batch')
        .send([validSignal, { ...validSignal, carrier: 'Globe' }]);

      expect(res.status).toBe(201);
      expect(res.body.inserted).toBe(2);

      const count = await SignalLog.countDocuments();
      expect(count).toBe(2);
    });

    test('rejects empty array', async () => {
      const res = await request(app).post('/api/signals/batch').send([]);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/non-empty/);
    });

    test('rejects batch larger than 100', async () => {
      const batch = Array(101).fill(validSignal);
      const res = await request(app).post('/api/signals/batch').send(batch);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/exceed 100/);
    });
  });

  describe('GET /api/signals', () => {
    beforeEach(async () => {
      await SignalLog.create([
        validSignal,
        {
          ...validSignal,
          location: { type: 'Point', coordinates: [122.0, 15.0], accuracy: 5 },
          carrier: 'Globe',
        },
        {
          ...validSignal,
          carrier: 'TNT',
          networkType: '3G',
        },
      ]);
    });

    test('requires viewport bounds', async () => {
      const res = await request(app).get('/api/signals');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/bounds/i);
    });

    test('returns signals within viewport', async () => {
      const res = await request(app).get('/api/signals').query({
        sw_lng: 120.5,
        sw_lat: 14.0,
        ne_lng: 121.5,
        ne_lat: 15.0,
      });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
    });

    test('filters by carrier', async () => {
      const res = await request(app).get('/api/signals').query({
        sw_lng: 120.0,
        sw_lat: 14.0,
        ne_lng: 123.0,
        ne_lat: 16.0,
        carrier: 'Smart',
      });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].carrier).toBe('Smart');
    });

    test('filters by multiple carriers', async () => {
      const res = await request(app).get('/api/signals').query({
        sw_lng: 120.0,
        sw_lat: 14.0,
        ne_lng: 123.0,
        ne_lat: 16.0,
        carrier: 'Smart,TNT',
      });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
    });

    test('filters by networkType', async () => {
      const res = await request(app).get('/api/signals').query({
        sw_lng: 120.0,
        sw_lat: 14.0,
        ne_lng: 123.0,
        ne_lat: 16.0,
        networkType: '3G',
      });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].networkType).toBe('3G');
    });
  });
});
