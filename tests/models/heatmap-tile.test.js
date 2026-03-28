require('../setup');
const HeatmapTile = require('../../server/models/heatmap-tile');

describe('HeatmapTile Model', () => {
  const validTile = {
    swLng: 120.9,
    swLat: 14.4,
    neLng: 121.0,
    neLat: 14.5,
    zoomLevel: 12,
    carrier: 'all',
    networkType: 'all',
    avgDbm: -72.5,
    dataPointCount: 150,
    lastUpdated: new Date(),
  };

  test('creates a valid heatmap tile', async () => {
    const tile = await HeatmapTile.create(validTile);
    expect(tile._id).toBeDefined();
    expect(tile.avgDbm).toBe(-72.5);
    expect(tile.dataPointCount).toBe(150);
    expect(tile.swLng).toBe(120.9);
    expect(tile.swLat).toBe(14.4);
  });

  test('requires zoomLevel', async () => {
    const { zoomLevel, ...noZoom } = validTile;
    await expect(HeatmapTile.create(noZoom)).rejects.toThrow(/zoomLevel/i);
  });

  test('requires avgDbm', async () => {
    const { avgDbm, ...noDbm } = validTile;
    await expect(HeatmapTile.create(noDbm)).rejects.toThrow(/avgDbm/i);
  });

  test('can query by zoom, carrier, and networkType', async () => {
    await HeatmapTile.create(validTile);
    await HeatmapTile.create({
      ...validTile,
      carrier: 'Smart',
      networkType: '4G',
    });

    const smartTiles = await HeatmapTile.find({
      carrier: 'Smart',
      networkType: '4G',
      zoomLevel: 12,
    });
    expect(smartTiles).toHaveLength(1);
    expect(smartTiles[0].carrier).toBe('Smart');
  });

  test('can upsert tile by bounds + zoom + carrier + networkType', async () => {
    await HeatmapTile.create(validTile);

    await HeatmapTile.findOneAndUpdate(
      {
        swLng: 120.9,
        swLat: 14.4,
        neLng: 121.0,
        neLat: 14.5,
        zoomLevel: 12,
        carrier: 'all',
        networkType: 'all',
      },
      { avgDbm: -65.0, dataPointCount: 200, lastUpdated: new Date() },
      { upsert: true }
    );

    const tiles = await HeatmapTile.find({ carrier: 'all' });
    expect(tiles).toHaveLength(1);
    expect(tiles[0].avgDbm).toBe(-65.0);
    expect(tiles[0].dataPointCount).toBe(200);
  });
});
