const mongoose = require("mongoose");
const { add } = require("../queues/qrCodeQueue");

const MerchantSchema = new mongoose.Schema({
  merchantName: String,
  merchantMobile: String,
  merchantEmail: String,
  upiId: String,
  campaign: {
    type: mongoose.Schema.Types.String,
    ref: "Campaign",
  },
  company: {
    type: mongoose.Schema.Types.String,
    ref: "Company",
  },
  address: String,
  qrLink: String,
});

module.exports =
  mongoose.models["Merchant"] ||
  mongoose.model("Merchant", MerchantSchema);
