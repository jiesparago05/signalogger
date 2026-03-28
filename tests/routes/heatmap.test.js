require('../setup');
const request = require('supertest');
const app = require('../../server/app');
const HeatmapTile = require('../../server/models/heatmap-tile');

describe('Heatmap API', () => {
  beforeEach(async () => {
    await HeatmapTile.create([
      {
        swLng: 120.9, swLat: 14.4, neLng: 121.0, neLat: 14.5,
        zoomLevel: 12,
        carrier: 'all',
        networkType: 'all',
        avgDbm: -72.5,
        dataPointCount: 150,
      },
      {
        swLng: 121.0, swLat: 14.5, neLng: 121.1, neLat: 14.6,
        zoomLevel: 12,
        carrier: 'Smart',
        networkType: '4G',
        avgDbm: -60.0,
        dataPointCount: 80,
      },
      {
        swLng: 125.0, swLat: 10.0, neLng: 125.1, neLat: 10.1,
        zoomLevel: 12,
        carrier: 'all',
        networkType: 'all',
        avgDbm: -85.0,
        dataPointCount: 30,
      },
    ]);
  });

  describe('GET /api/heatmap/tiles', () => {
    test('requires viewport bounds', async () => {
      const res = await request(app).get('/api/heatmap/tiles');
      expect(res.status).toBe(400);
    });

    test('returns tiles within viewport', async () => {
      const res = await request(app).get('/api/heatmap/tiles').query({
        sw_lng: 120.0,
        sw_lat: 14.0,
        ne_lng: 122.0,
        ne_lat: 15.0,
        zoom: 12,
      });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
    });

    test('filters by carrier', async () => {
      const res = await request(app).get('/api/heatmap/tiles').query({
        sw_lng: 120.0,
        sw_lat: 14.0,
        ne_lng: 122.0,
        ne_lat: 15.0,
        zoom: 12,
        carrier: 'Smart',
      });

      expect(res.status).toBe(200);
      const carriers = res.body.data.map((t) => t.carrier);
      expect(carriers).toContain('Smart');
      expect(carriers).toContain('all');
    });
  });
});
