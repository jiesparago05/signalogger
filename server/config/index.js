const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/signalog',
  uploadDir: process.env.UPLOAD_DIR || path.resolve(__dirname, '../uploads'),
  heatmapCronInterval: process.env.HEATMAP_CRON_INTERVAL || '*/15 * * * *',
  carriers: ['Smart', 'Globe', 'TNT', 'GOMO', 'Sun', 'DITO'],
  networkTypes: ['2G', '3G', '4G', '5G', 'none'],
  reportCategories: ['dead_zone', 'weak_signal', 'intermittent', 'slow_data'],
  sync: {
    maxBatchSize: 100,
  },
};

module.exports = config;
