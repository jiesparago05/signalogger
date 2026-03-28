require('../setup');
const request = require('supertest');
const app = require('../../server/app');

describe('Carriers API', () => {
  describe('GET /api/carriers', () => {
    test('returns list of carriers', async () => {
      const res = await request(app).get('/api/carriers');

      expect(res.status).toBe(200);
      expect(res.body.carriers).toEqual([
        'Smart',
        'Globe',
        'TNT',
        'GOMO',
        'Sun',
        'DITO',
      ]);
    });

    test('returns list of network types', async () => {
      const res = await request(app).get('/api/carriers');

      expect(res.status).toBe(200);
      expect(res.body.networkTypes).toEqual(['2G', '3G', '4G', '5G', 'none']);
    });

    test('returns report categories', async () => {
      const res = await request(app).get('/api/carriers');

      expect(res.status).toBe(200);
      expect(res.body.reportCategories).toEqual([
        'dead_zone',
        'weak_signal',
        'intermittent',
        'slow_data',
      ]);
    });
  });
});
