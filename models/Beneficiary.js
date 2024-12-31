const mongoose = require("mongoose");

const BeneficiarySchema = new mongoose.Schema({
  beneficiaryName: String,
  beneficiaryMobile: String,
  beneficiaryEmail: String,
  upiId: String,
  campaign: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Campaign",
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
  },
});

module.exports = mongoose.model("Beneficiary", BeneficiarySchema);
