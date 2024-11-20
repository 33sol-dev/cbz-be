// models/Transaction.js

const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  code: { type: mongoose.Schema.Types.ObjectId, ref: 'Code' },
  amount: { type: Number, default: 0 }, // For cashback, else 0
  status: { type: String, enum: ['SUCCESS', 'FAILED'], required: true },
  response: { type: mongoose.Schema.Types.Mixed }, // Store API responses
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Transaction', TransactionSchema);
