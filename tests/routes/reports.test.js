require('../setup');
const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../../server/app');
const ManualReport = require('../../server/models/manual-report');
const config = require('../../server/config');

describe('Reports API', () => {
  const validReport = {
    timestamp: new Date().toISOString(),
    location: { type: 'Point', coordinates: [121.0, 14.5] },
    carrier: 'Smart',
    networkType: '4G',
    category: 'dead_zone',
    deviceId: 'test-device-001',
  };

  beforeAll(() => {
    if (!fs.existsSync(config.uploadDir)) {
      fs.mkdirSync(config.uploadDir, { recursive: true });
    }
  });

  describe('POST /api/reports', () => {
    test('creates a valid report', async () => {
      const res = await request(app).post('/api/reports').send(validReport);

      expect(res.status).toBe(201);
      expect(res.body.category).toBe('dead_zone');
      expect(res.body._id).toBeDefined();
    });

    test('creates report with note', async () => {
      const res = await request(app)
        .post('/api/reports')
        .send({ ...validReport, note: 'Totally dead here' });

      expect(res.status).toBe(201);
      expect(res.body.note).toBe('Totally dead here');
    });

    test('rejects invalid category', async () => {
      const res = await request(app)
        .post('/api/reports')
        .send({ ...validReport, category: 'fake_category' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid category/);
    });
  });

  describe('GET /api/reports', () => {
    beforeEach(async () => {
      await ManualReport.create([
        validReport,
        {
          ...validReport,
          location: { type: 'Point', coordinates: [122.0, 15.0] },
          category: 'weak_signal',
          carrier: 'Globe',
        },
      ]);
    });

    test('returns reports within viewport', async () => {
      const res = await request(app).get('/api/reports').query({
        sw_lng: 120.5,
        sw_lat: 14.0,
        ne_lng: 121.5,
        ne_lat: 15.0,
      });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].category).toBe('dead_zone');
    });

    test('filters by carrier', async () => {
      const res = await request(app).get('/api/reports').query({
        sw_lng: 120.0,
        sw_lat: 14.0,
        ne_lng: 123.0,
        ne_lat: 16.0,
        carrier: 'Globe',
      });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].carrier).toBe('Globe');
    });
  });

  describe('POST /api/reports/upload', () => {
    test('uploads a photo and attaches to report', async () => {
      const report = await ManualReport.create(validReport);

      const testFilePath = path.join(config.uploadDir, 'test-photo.jpg');
      fs.writeFileSync(testFilePath, Buffer.alloc(100, 0xff));

      const res = await request(app)
        .post('/api/reports/upload')
        .field('reportId', report._id.toString())
        .attach('file', testFilePath);

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('photo');
      expect(res.body.url).toMatch(/\/uploads\//);
      expect(res.body.size).toBeGreaterThan(0);

      const updated = await ManualReport.findById(report._id);
      expect(updated.attachments).toHaveLength(1);

      fs.unlinkSync(testFilePath);
    });

    test('rejects upload without reportId', async () => {
      const testFilePath = path.join(config.uploadDir, 'test-photo2.jpg');
      fs.writeFileSync(testFilePath, Buffer.alloc(100, 0xff));

      const res = await request(app)
        .post('/api/reports/upload')
        .attach('file', testFilePath);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/reportId/);

      fs.unlinkSync(testFilePath);
    });
  });
});
