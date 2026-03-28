const mongoose = require('mongoose');
const config = require('./config');
const app = require('./app');

mongoose
  .connect(config.mongoUri)
  .then(() => {
    console.log('Connected to MongoDB');

    app.listen(config.port, () => {
      console.log(`Signalog API running on port ${config.port}`);
    });

    // Start heatmap aggregation worker
    require('./workers/heatmap-aggregator').start();
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
