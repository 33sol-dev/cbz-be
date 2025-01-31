const mongoose = require("mongoose");

const beneficiarySchema = new mongoose.Schema({
  beneId: String,
  name: String,
  phone: String,
  email: {
    type: String,
    default: "dummy@gmail.com",
  }, // Dummy email as it's required
  vpa: String, // UPI ID (Google Pay, PhonePe, Paytm, etc.)
  address1: "N/A",
});

module.exports =
  mongoose.models["Beneficiary"] ||
  mongoose.model("Beneficiary", beneficiarySchema);
