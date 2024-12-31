const mongoose = require("mongoose");

const BeneficiarySchema = new mongoose.Schema({
  beneficiaryName: String,
  beneficiaryMobile: String,
  beneficiaryEmail: String,
  upiId: String,
});

module.exports = mongoose.model("Beneficiary", BeneficiarySchema);
