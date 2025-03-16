/********************************
 * controllers/campaignCreator.js
 ********************************/
const Campaign = require("../models/Campaign");
const Company = require("../models/Company");
const { generateRandomPin } = require("../utils/pinGenerator");
const { validationResult } = require("express-validator");
const Merchant = require("../models/Merchant");
const Code = require("../models/Code");
const qrCodeQueue = require("../queues/qrCodeQueue");
const logger = require("../utils/logger");

/**
 * Generate a new campaign based on template type.
 * - `award` and `digital_activation` share common logic.
 * - `product` has its own code-based logic (bulk QR generation).
 */
exports.generateCampaign = async (req, res) => {
  // Validate request body
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const {
      name,
      description,
      totalAmount,
      rewardAmount,
      campaignTemplate, // "award", "digital_activation", or "product"
      company,
      merchants,        // array of merchants
      noOfSamples,      // used for product campaigns
      triggerText,
      taskType,
      taskUrl,
      tags,
      payoutConfig      // for "award" variable payouts
    } = req.body;

    // Basic validations
    const publishPin = generateRandomPin();
    const companyData = await Company.findById(company);
    if (!companyData) {
      return res.status(404).json({ message: "Company not found" });
    }
    const userId = companyData.user; // or however your code determines user ownership

    let campaign;

    switch (campaignTemplate) {
      case "product":
        campaign = await generateProductCampaign({
          name,
          description,
          noOfSamples,
          rewardAmount,
          campaignTemplate,
          company,
          userId,
          tags,
          publishPin,
          // We still pass along a simple taskConfig for product (if needed)
          taskConfig: { taskType, taskUrl, triggerText },
        });
        break;

      case "award":
      case "digital_activation":
        campaign = await generateNonProductCampaign({
          name,
          description,
          totalAmount,
          rewardAmount,
          campaignTemplate,
          company,
          merchants,
          userId,
          tags,
          publishPin,
          // Unify task-related fields into one object
          taskConfig: { taskType, taskUrl, triggerText },
          payoutConfig
        });
        break;

      default:
        return res.status(400).json({ message: "Invalid campaign template" });
    }

    return res.json({ campaign });
  } catch (err) {
    logger.error("Error creating campaign:", err);
    return res.status(500).json({ message: "Server error", error: err.toString() });
  }
};

/**
 * 1) Non-Product Campaigns (award OR digital_activation).
 *    - Creates the Campaign entry (status "Ready").
 *    - If `merchants` are passed, create them & generate a unique merchant code for each.
 */
async function generateNonProductCampaign({
  name,
  description,
  totalAmount,
  rewardAmount,
  campaignTemplate,
  company,
  merchants,
  userId,
  tags,
  publishPin,
  taskConfig,   // { taskType, taskUrl, triggerText }
  payoutConfig, // e.g. for "award" dynamic payouts
}) {
  // Build a rewardConfig that can store all fields in a single place
  const rewardConfig = {
    rewardType: "cashback", // or "gift", etc. You can adapt the logic as needed
    rewardAmount,
    payoutConfig: mapifyConfig(payoutConfig) // Convert object to Map (if needed by your schema)
  };

  const campaign = await Campaign.create({
    name,
    description,
    campaignTemplate,
    company,
    status: "Ready", // for demonstration
    tags,
    publishPin,
    user: userId,
    "taskConfig.taskType": taskConfig.taskType,
    "taskConfig.taskUrl":  taskConfig.taskUrl,
    "taskConfig.triggerText": taskConfig.triggerText,

    // For award:
    totalAmount: totalAmount || 0,
    rewardAmount: rewardAmount || 0,
    
    rewardConfig,
  });

  // (Optional) Provide a link so external merchants can sign up
  campaign.merchantRegistrationLink = `${process.env.MERCHANT_REGISTRATION_URL}?campaign=${campaign.id}&company=${company}`;
  await campaign.save();

  // If the user included an array of merchants up-front, attach them
  if (Array.isArray(merchants) && merchants.length > 0) {
    await Promise.all(
      merchants.map((m) => createMerchantAndCode({
        merchantName: m.name,
        upiId: m.upiId,
        merchantMobile: m.mobileNumber,
        merchantEmail: m.email,
        address: m.address,
        company,
        campaignId: campaign.id,
        campaignTemplate,      // needed if you do special logic
        taskUrl: taskConfig.taskUrl // if needed for generating a dynamic QR
      }))
    );
  }

  return campaign;
}

/**
 * 2) Product Campaign: 
 *    - Creates the campaign (status "Pending" or "Ready" as needed).
 *    - Bulk-generate unique codes -> push them to a background queue for QR generation.
 */
async function generateProductCampaign({
  name,
  description,
  noOfSamples,
  rewardAmount,
  campaignTemplate,
  company,
  userId,
  tags,
  publishPin,
  taskConfig // {taskType, taskUrl, ...}
}) {
  const campaign = await Campaign.create({
    name,
    description,
    campaignTemplate,
    company,
    tags,
    status: "Pending", // often "product" campaigns wait for all QRs to generate
    user: userId,
    publishPin,
    "taskConfig.taskType": taskConfig.taskType,
    "taskConfig.taskUrl":  taskConfig.taskUrl, // e.g. https://my-brand.com/landing?code=
    "taskConfig.triggerText": taskConfig.triggerText,
    noOfSamples,
    rewardAmount
  });

  // Prepare random codes (prefix "BOUNTY...")
  const codesToGenerate = [];
  const prefix = "BOUNTY";
  for (let i = 0; i < noOfSamples; i++) {
    const randNum = Math.floor(10000 + Math.random() * 900000);
    codesToGenerate.push(prefix + randNum);
  }

  // Offload actual Code creation to a background queue (for async QR generation)
  await qrCodeQueue.add("qrCodeGeneration", {
    companyId: company,
    campaignId: campaign.id,
    codes: codesToGenerate,
    campaignTemplate,
    // The final taskUrl typically already has "?code=" appended, e.g. https://my-brand.com/redeem?code=
    taskUrl: taskConfig.taskUrl,
    // ... any other data needed
  });

  return campaign;
}

/**
 * Helper to attach a new merchant to a campaign with a unique code & optional QR link
 * This logic can also be used stand-alone if you want to "attach later".
 */
async function createMerchantAndCode({
  merchantName,
  upiId,
  merchantMobile,
  merchantEmail,
  address,
  company,
  campaignId,
  campaignTemplate,
  taskUrl
}) {
  try {
    // Create the merchant in DB
    const merchant = await Merchant.create({
      merchantName,
      upiId,
      merchantMobile,
      merchantEmail,
      campaign: campaignId,
      company,
      address,
    });

    // Create a unique code for the merchant 
    const uniqueCode = "MERC-" + Math.floor(100000 + Math.random() * 900000);
    const merchantCodeDoc = await Code.create({
      code: uniqueCode,
      company,
      campaignTemplate,
      campaign: campaignId,
      merchant: merchant._id,
      // You can store a direct URL if you want the merchant to have a scannable link
      url: taskUrl ? `${taskUrl}?merchant=${merchant._id}&code=${uniqueCode}` : null,
    });

    // Optionally store a "qrLink" on the merchant doc
    merchant.merchantCode = uniqueCode;
    merchant.qrLink = merchantCodeDoc.url;
    await merchant.save();

    return merchant;
  } catch (err) {
    logger.error("Error creating merchant + code:", err);
    throw new Error("Failed to create merchant object");
  }
}

/**
 * Convert a plain object (from request body) into a Map if needed.
 * This is only used if your Mongoose schema defines `rewardConfig.payoutConfig` as a Map.
 */
function mapifyConfig(obj) {
  if (!obj || typeof obj !== "object") {
    return new Map();
  }
  return new Map(Object.entries(obj));
}
