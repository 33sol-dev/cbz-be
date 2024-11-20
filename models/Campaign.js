// models/Campaign.js

const mongoose = require('mongoose');

const CampaignSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  triggerText: { type: String, unique: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  customFieldConfig: [
    {
      fieldName: { type: String, required: true },
      required: { type: Boolean, default: false },
    },
  ],
  publishPin: { type: String }, 
  name: { type: String, required: true },
  description: { type: String },
  totalAmount: { type: Number, required: true },
  tags: [String],
  zipUrl: { type: String },
  status: { type: String,   enum: ['Pending', 'Processing', 'Ready', 'Active', 'Completed'], default: 'Pending' },
  triggerText: { type: String, required: false }, 
  payoutConfig: { type: Map, of: Number, default: {} }, 
  reward_type: {
    type: String,
    enum: ['cashback', 'gift'],
    default: 'cashback',
  },
  bounty_cashback_config: {
    avg_amount: { type: Number },
    max_amount: { type: Number },
    min_amount: { type: Number },
    total_amount: { type: Number },
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Campaign', CampaignSchema);              