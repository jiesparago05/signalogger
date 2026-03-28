const ManualReport = require('../models/manual-report');
const config = require('../config');

async function createReport(data) {
  if (!data.category || !config.reportCategories.includes(data.category)) {
    throw new Error(
      `Invalid category. Must be one of: ${config.reportCategories.join(', ')}`
    );
  }
  return ManualReport.create(data);
}

async function queryByViewport(bounds, filters = {}) {
  const query = {
    location: {
      $geoWithin: {
        $box: [bounds.sw, bounds.ne],
      },
    },
  };

  if (filters.carrier && filters.carrier.length > 0) {
    query.carrier = { $in: filters.carrier };
  }
  if (filters.networkType && filters.networkType.length > 0) {
    query.networkType = { $in: filters.networkType };
  }

  return ManualReport.find(query).sort({ timestamp: -1 }).limit(200).lean();
}

async function addAttachment(reportId, attachment) {
  return ManualReport.findByIdAndUpdate(
    reportId,
    { $push: { attachments: attachment } },
    { new: true }
  );
}

module.exports = { createReport, queryByViewport, addAttachment };
