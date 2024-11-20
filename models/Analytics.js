const mongoose = require('mongoose');

const AnalyticsSchema = new mongoose.Schema({
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
  action: { type: String },
  metadata: { type: Object },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Analytics', AnalyticsSchema);
