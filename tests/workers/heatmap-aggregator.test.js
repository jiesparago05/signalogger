require('../setup');
const SignalLog = require('../../server/models/signal-log');
const HeatmapTile = require('../../server/models/heatmap-tile');
const { aggregate } = require('../../server/workers/heatmap-aggregator');

describe('Heatmap Aggregator', () => {
  beforeEach(async () => {
    const baseLog = {
      location: { type: 'Point', coordinates: [121.0, 14.5], accuracy: 10 },
      carrier: 'Smart',
      networkType: '4G',
      signal: { dbm: -60 },
      connection: { isWifi: false },
      deviceId: 'device-001',
      synced: true,
    };

    await SignalLog.create([
      { ...baseLog, timestamp: new Date(), signal: { dbm: -60 } },
      { ...baseLog, timestamp: new Date(), signal: { dbm: -70 } },
      { ...baseLog, timestamp: new Date(), signal: { dbm: -80 } },
      {
        ...baseLog,
        timestamp: new Date(),
        carrier: 'Globe',
        networkType: '5G',
        signal: { dbm: -50 },
      },
    ]);
  });

  test('creates heatmap tiles with averaged signal strength', async () => {
    await aggregate();

    const allTiles = await HeatmapTile.find({ carrier: 'all' });
    expect(allTiles.length).toBeGreaterThan(0);

    const tile = allTiles[0];
    expect(tile.dataPointCount).toBe(4);
    expect(tile.avgDbm).toBe(-65);
  });

  test('creates per-carrier tiles', async () => {
    await aggregate();

    const smartTiles = await HeatmapTile.find({
      carrier: 'Smart',
      networkType: '4G',
    });
    expect(smartTiles.length).toBeGreaterThan(0);
    expect(smartTiles[0].dataPointCount).toBe(3);
    expect(smartTiles[0].avgDbm).toBeCloseTo(-70, 0);
  });

  test('upserts tiles on re-run (no duplicates)', async () => {
    await aggregate();
    await aggregate();

    const allTiles = await HeatmapTile.find({ carrier: 'all', zoomLevel: 12 });
    expect(allTiles.length).toBe(1);
  });
});
