const mongoose = require("mongoose");

const CampaignSchema = new mongoose.Schema(
  {
    // Reference to the user who created the campaign
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Campaign name and description
    name: { type: String, required: true },
    description: { type: String },

    // Associated company
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },

    // Campaign trigger text (unique identifier for triggering actions)
    triggerText: { type: String, unique: true },

    // Configuration for custom fields
    customFieldConfig: [
      {
        fieldName: { type: String, required: true },
        required: { type: Boolean, default: false },
      },
    ],

    // Publish pin for securing publication
    publishPin: { type: String },

    // Financial details
    totalAmount: { type: Number, required: true },
    payoutConfig: { type: Map, of: Number, default: {} },
    rewardType: {
      type: String,
      enum: ["cashback", "gift"],
      default: "cashback",
    },

    // Configuration for cashback bounty rewards
    bountyCashbackConfig: {
      avgAmount: { type: Number },
      maxAmount: { type: Number },
      minAmount: { type: Number },
      totalAmount: { type: Number },
    },

    // Campaign tags for categorization
    tags: [{ type: String }],

    // External resources
    zipUrl: { type: String },

    // Campaign status
    status: {
      type: String,
      enum: ["Pending", "Processing", "Ready", "Active", "Completed"],
      default: "Pending",
    },

    // Task type associated with the campaign
    taskType: {
      type: String,
      enum: ["award", "digital_activation", "social_media", "location_sharing","video_watching"],
      default: "award",
    },

    beneficiaries: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Beneficiary",
      },
    ],

    // Generate A Single QR code for Digital Activation and Beneficiary benefits else false for single QR USER
    uniqueQrCodes: {
      type: Boolean,
      default: true,
    },

    // Timestamps
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Campaign", CampaignSchema);
