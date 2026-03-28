require('../setup');
const ManualReport = require('../../server/models/manual-report');

describe('ManualReport Model', () => {
  const validReport = {
    timestamp: new Date(),
    location: {
      type: 'Point',
      coordinates: [121.0, 14.5],
    },
    carrier: 'Globe',
    networkType: '3G',
    category: 'dead_zone',
    deviceId: 'test-device-001',
    synced: false,
  };

  test('creates a valid report', async () => {
    const report = await ManualReport.create(validReport);
    expect(report._id).toBeDefined();
    expect(report.category).toBe('dead_zone');
    expect(report.carrier).toBe('Globe');
  });

  test('requires category field', async () => {
    const { category, ...noCategory } = validReport;
    await expect(ManualReport.create(noCategory)).rejects.toThrow(/category/i);
  });

  test('validates category enum', async () => {
    await expect(
      ManualReport.create({ ...validReport, category: 'invalid' })
    ).rejects.toThrow(/category/i);
  });

  test('allows all valid categories', async () => {
    const categories = ['dead_zone', 'weak_signal', 'intermittent', 'slow_data'];
    for (const category of categories) {
      const report = await ManualReport.create({ ...validReport, category });
      expect(report.category).toBe(category);
    }
  });

  test('allows optional note with max 500 chars', async () => {
    const report = await ManualReport.create({
      ...validReport,
      note: 'No signal here at all',
    });
    expect(report.note).toBe('No signal here at all');
  });

  test('rejects note longer than 500 chars', async () => {
    await expect(
      ManualReport.create({ ...validReport, note: 'x'.repeat(501) })
    ).rejects.toThrow();
  });

  test('allows attachments array', async () => {
    const report = await ManualReport.create({
      ...validReport,
      attachments: [
        { type: 'photo', url: '/uploads/photo-123.jpg', size: 1024000 },
        { type: 'voice_note', url: '/uploads/voice-456.m4a', size: 512000 },
      ],
    });
    expect(report.attachments).toHaveLength(2);
    expect(report.attachments[0].type).toBe('photo');
    expect(report.attachments[1].type).toBe('voice_note');
  });

  test('supports geospatial query', async () => {
    await ManualReport.create(validReport);
    const results = await ManualReport.find({
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
  });
});
