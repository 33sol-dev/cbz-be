const mongoose = require("mongoose");
const CampaignSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  campaignTemplate: { type: String, enum: ["product", "award", "digital_activation"], required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
  status: { type: String, enum: ["Pending", "Processing", "Ready", "Active", "Completed"], default: "Pending" },
  tags: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  publishPin: { type: String, required: true },

  // Task Configuration (Common fields)
  taskConfig: {
      taskType: { type: String, required: true }, // e.g., "purchase", "video_view", "social_share"
      taskUrl: { type: String }, // URL for video view, social share, etc.
      triggerText: { type: String }, // WhatsApp trigger
  },

  // Reward Configuration (Structure depends on campaign type)
   rewardConfig: {
      rewardType: { type: String, enum: ["cashback", "gift", "discount", "code","sample"], default: "cashback" }, // Type of reward
      rewardAmount: { type: Number }, // Fixed reward amount (if applicable)
      discountPercentage: { type: Number }, // For discount rewards
      discountAmount: { type: Number },   // Fixed discount
      discountValidTill: { type: Date }, // Discount expiry
      couponCode: {type: String},      // For coupon codes
      sampleCode: {type: Boolean, default: false},
      payoutConfig: { // For variable merchant payouts in "award" campaign
          type: Map,
          of: {
              min: { type: Number },
              max: { type: Number },
              avg: { type: Number }
          },
          default: {}
      },
      //for product campaign
      levels: { // Tiered cashback for "product" campaign
          type: Map,
          of: { type: Number }, // Key: level (e.g., "1", "2"), Value: cashback amount
          default: {}
      },
      bounty_cashback_config: { // For variable customer payouts in "award" campaign
           type: Map,
          of: {
              min: { type: Number },
              max: { type: Number },
              avg: { type: Number }
          },
          default: {}
      }
  },

  // --- Campaign-Specific Fields ---
  // Product Campaign
  noOfSamples: { type: Number }, // Number of QR codes for "product" campaign

  // Award & Digital Activation Campaigns
  merchant: { type: mongoose.Schema.Types.ObjectId, ref: "Merchant" }, //  "award" OR "digital_activation" (if merchant involved)
  customFieldConfig: [{
      fieldName: { type: String },
      fieldType: { type: String },  // "text", "number", "date", "email", etc.
      required: { type: Boolean, default: false },
  }],
  merchantRegistrationLink: { type: String }
});

module.exports = mongoose.model("Campaign", CampaignSchema);