const mongoose = require("mongoose");
const { name } = require("../queues/qrCodeQueue");

const CampaignSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  totalAmount: { type: Number },
  rewardAmount: { type: Number },
  campaignTemplate: { type: String },
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
  noOfSamples: { type: Number },
  merchantRegistrationLink: { type: String },
  taskUrl: { type: String },
  status: {
    type: String,
    enum: ["Pending", "Processing", "Ready", "Active", "Completed"],
    default: "Pending",
  },
  tags: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  triggerText: { type: String },
  updatedAt: { type: Date, default: Date.now },
  publishPin: { type: String },
});

module.exports = mongoose.model("Campaign", CampaignSchema);
