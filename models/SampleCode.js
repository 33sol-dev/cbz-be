// models/SampleCode.js
const mongoose = require("mongoose");

const SampleCodeSchema = new mongoose.Schema(
  {
    macAddress: {
      type: String,
    },
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
    },
    code: {
      type: String,
      required: true,
    },
    merchant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
    },
    samplerMobile:{
        type: String,
        required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models["SampleCode"] ||
  mongoose.model("SampleCode", SampleCodeSchema);