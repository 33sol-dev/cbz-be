// models/Merchant.js
const mongoose = require("mongoose");

const MerchantSchema = new mongoose.Schema({
  merchantName: String,
  merchantMobile: String,
  merchantEmail: String,
  upiId: String,
  merchantCode:String,
  campaign: {
    type: mongoose.Schema.Types.ObjectId, // Corrected type
    ref: "Campaign",
  },
  company: {
    type: mongoose.Schema.Types.ObjectId, // Corrected type
    ref: "Company",
  },
  address: String,
  qrLink: String,
});

// Add indexes
MerchantSchema.index({ campaign: 1 });
MerchantSchema.index({ company: 1 });
MerchantSchema.index({ merchantMobile: 1 });
MerchantSchema.index({ upiId: 1 });
MerchantSchema.index({merchantCode: 1})

module.exports =
  mongoose.models["Merchant"] || mongoose.model("Merchant", MerchantSchema);