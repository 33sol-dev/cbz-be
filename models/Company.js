// models/Company.js

const mongoose = require('mongoose');

const RechargeSchema = new mongoose.Schema({
  planName: { type: String },
  qrCodesAdded: { type: Number },
  amount: { type: Number },
  date: { type: Date, default: Date.now },
});

const CompanySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  contactName: { type: String },
  email: { type: String, required: true },
  phoneNumber: { type: String },
  description: { type: String },
  website: { type: String },
  gstin: { type: String, sparse: true },
  pan: { type: String, sparse: true },
  industry: { type: String },
  whatsappNumber: { type: String }, // For custom WhatsApp number
  qrCodeBalance: { type: Number, default: 3 }, // Start with 3 for trial
  recharges: [RechargeSchema],
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Company', CompanySchema);
