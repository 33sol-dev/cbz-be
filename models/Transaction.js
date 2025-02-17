// models/Transaction.js
const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  code: { type: mongoose.Schema.Types.ObjectId, ref: 'Code' }, // Can be null (for direct rewards)
  amount: { type: Number, default: 0 },  // For cashback, else 0
  status: { type: String, enum: ['SUCCESS', 'FAILED'], required: true },
  response: { type: mongoose.Schema.Types.Mixed }, // Store API responses (for debugging)
  createdAt: { type: Date, default: Date.now },
});

// Add indexes
TransactionSchema.index({ customer: 1 });
TransactionSchema.index({ company: 1 });
TransactionSchema.index({ campaign: 1 });
TransactionSchema.index({ code: 1 });
TransactionSchema.index({ status: 1 });


module.exports = mongoose.model('Transaction', TransactionSchema);