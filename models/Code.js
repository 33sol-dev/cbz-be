// models/Code.js

const mongoose = require("mongoose");

const CodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
  },
  campaignTemplate: {
    type: String,
    required: true,
  },
  campaign: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Campaign",
    required: true,
  },
  isUsed: { type: Boolean, default: false },
  usedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  usedAt: { type: Date },
  merchant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Merchant",
  },
  url: { type: String },
});

module.exports = mongoose.model("Code", CodeSchema);
