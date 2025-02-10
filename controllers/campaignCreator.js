// import Merchant from "../models/Merchant";
// import Campaign from "../models/Campaign";
// import Code from "../models/Code";
// import qrCodeQueue from "../queues/qrCodeQueue";
// import { generateRandomPin } from "../utils/pinGenerator";

const Merchant = require("../models/Merchant");
const Campaign = require("../models/Campaign");
const Code = require("../models/Code");
const qrCodeQueue = require("../queues/qrCodeQueue");
const { generateRandomPin } = require("../utils/pinGenerator");
const Company = require("../models/Company");
const { generateMerchantObject } = require("./merchantController");

/**
 * Generate a campaign based on the template type
 */
exports.generateCampaign = async (req, res) => {
  try {
    let {
      name,
      description,
      totalAmount,
      rewardAmount,
      campaignTemplate,
      company,
      merchants,
      noOfSamples,
      triggerText,
      taskType,
      taskUrl,
      tags,
    } = req.body;
    console.log(req.body);

    const publishPin = generateRandomPin();
    // Validate required fields
    if (!name || !company) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const companyData = await Company.findById(company);
    if (!companyData) {
      return res.status(404).json({ message: "Company not found" });
    }

    const userId = companyData.companyId;

    let campaign;

    // Handle different campaign templates
    if (campaignTemplate === "award") {
      campaign = await generateTaskCampaign({
        name,
        description,
        totalAmount,
        rewardAmount,
        campaignTemplate,
        taskType,
        triggerText,
        company,
        merchants,
        taskUrl,
        tags,
        publishPin,
        userId,
        triggerText,
      });
    } else if (campaignTemplate === "product") {
      if (!triggerText)
        return res
          .status(400)
          .json({ message: "Missing triggerText for product campaign" });
      campaign = await generateProductCampaign({
        name,
        description,
        totalAmount,
        rewardAmount,
        campaignTemplate,
        company,
        noOfSamples,
        userId,
        taskType,
        triggerText,
        tags,
        publishPin,
        userId,
      });
    } else if (campaignTemplate === "digital_activation") {
      console.log("digital_activation");
      campaign = await generateSampleGiveAwayCampaign({
        name,
        description,
        campaignTemplate,
        company,
        merchants,
        taskUrl,
        triggerText,
        taskType,
        tags,
        publishPin,
        userId,
        triggerText,
      });
    } else {
      return res.status(400).json({ message: "Invalid campaign template" });
    }

    return res.json({ campaign });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Server error", error: err.toString() });
  }
};

/**
 * Generate a Task Campaign
 */
const generateTaskCampaign = async ({
  name,
  description,
  totalAmount,
  rewardAmount,
  campaignTemplate,
  company,
  merchants,
  triggerText,
  taskUrl,
  taskType,
  tags,
  publishPin,
  userId,
}) => {
  const campaign = await Campaign.create({
    name,
    description,
    status: "Ready",
    totalAmount,
    taskUrl,
    triggerText,
    rewardAmount,
    taskType,
    campaignTemplate,
    company,
    publishPin: publishPin || generateRandomPin(),
    tags,
    user: userId,
    triggerText,
  });

  campaign.merchantRegistrationLink = `${process.env.FRONTEND_URL}/campaigns/register-merchant?campaign=${campaign.id}&company=${company}`;
  await campaign.save();

  if (merchants && merchants.length > 0) {
    await Promise.all(
      merchants.map(async (merchant) => {
        await generateMerchantObject({
          merchantName: merchant.name,
          upiId: merchant.upiId,
          merchantMobile: merchant.mobileNumber,
          merchantEmail: merchant.email,
          company,
          campaignTemplate: campaign.campaignTemplate,
          address: merchant.address,
          campaignId: campaign.id,
        });
      })
    );
  }

  return campaign;
};

/**
 * Generate a Product Campaign
 */
const generateProductCampaign = async ({
  name,
  description,
  taskType,
  noOfSamples,
  rewardAmount,
  campaignTemplate,
  company,
  userId,
  triggerText,
  tags,
  publishPin,
}) => {
  const campaign = await Campaign.create({
    name,
    description,
    status: "Pending",
    taskType,
    rewardAmount,
    noOfSamples,
    triggerText,
    campaignTemplate,
    company,
    publishPin: publishPin || generateRandomPin(),
    tags,
  });

  const codes = new Set();
  const existingCodeDocs = await Code.find({}, { code: 1 });

  existingCodeDocs.forEach((doc) => codes.add(doc.code));

  const prefix = "BOUNTY";

  const generatedCodes = [];
  while (generatedCodes.length < noOfSamples) {
    const randomNum = Math.floor(10000 + Math.random() * 900000);
    const code = `${prefix}${randomNum}`;
    if (!codes.has(code)) {
      generatedCodes.push(code);
      codes.add(code);
    }
  }
  console.log("Generating These COdes in the Queue", generatedCodes);
  await qrCodeQueue.add("qrCodeGeneration", {
    companyId: company,
    campaignId: campaign.id,
    codes: generatedCodes,
    triggerText: triggerText,
    campaignTemplate,
    taskUrl: process.env.WHATSAPP_REDIRECT_URL,
    mobileNumber: "0000000000", // Placeholder (should be fetched dynamically if needed)
    userId: userId,
  });

  return campaign;
};

/**
 * Generate a Sample Giveaway Campaign
 */
const generateSampleGiveAwayCampaign = async ({
  name,
  description,
  triggerText,
  campaignTemplate,
  company,
  taskType,
  merchants,
  taskUrl,
  tags,
  publishPin,
}) => {
  console.log(`Creating Campaign for ${campaignTemplate} ${company}`);
  const campaign = await Campaign.create({
    taskType,
    name,
    description,
    triggerText,
    taskUrl,
    status: "Ready",
    campaignTemplate,
    company,
    publishPin: publishPin || generateRandomPin(),
    tags,
    triggerText,
  });

  campaign.merchantRegistrationLink = `${process.env.FRONTEND_URL}/campaigns/register-merchant?campaign=${campaign.id}&company=${company}`;
  await campaign.save();
  console.log("Campaign Creation Syccessful");
  if (merchants && merchants.length > 0) {
    await Promise.all(
      merchants.map(async (merchant) => {
        await generateMerchantObject({
          merchantName: merchant.name,
          upiId: merchant.upiId,
          merchantMobile: merchant.mobileNumber,
          merchantEmail: merchant.email,
          company: company,
          campaignTemplate,
          address: merchant.address,
          campaignId: campaign.id,
        });
      })
    );
  }

  return campaign;
};
