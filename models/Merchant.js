// models/Merchant.js
const mongoose = require("mongoose");

// models/Merchant.js
const MerchantSchema = new mongoose.Schema({
  merchantName: String,
  merchantMobile: String,
  merchantEmail: String,
  upiId: String,
  merchantCode: String,
  campaign: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Campaign",
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
  },
  address: String,
  qrLink: String,
  status: {
    type: String,
    enum: ["active", "paused"],
    default: "active",
  },
  // New field to indicate if this is a dummy merchant
  isDummy: {
    type: Boolean,
    default: false,
  },
});

// ...indexes and export


// Add indexes
MerchantSchema.index({ campaign: 1 });
MerchantSchema.index({ company: 1 });
MerchantSchema.index({ merchantMobile: 1 });
MerchantSchema.index({ upiId: 1 });
MerchantSchema.index({ merchantCode: 1 });

module.exports =
  mongoose.models["Merchant"] || mongoose.model("Merchant", MerchantSchema);
