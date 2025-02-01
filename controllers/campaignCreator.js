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

const templateToLinkMap = {
  video_watching: "https://www.youtube.com/watch?v=6v2L2UGZJAM",
  location_sharing: "https://www.google.com/maps",
  digital_activation: "https://www.google.com",
  social_media: "https://www.facebook.com",
};

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
      tags,
      publishPin,
    } = req.body;
    console.log(req.body);
    // Validate required fields
    if (!name || !totalAmount || !company) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const companyData = await Company.findById(company);
    if (!companyData) {
      return res.status(404).json({ message: "Company not found" });
    }

    const userId = companyData.user;


    let campaign;

    // Handle different campaign templates
    if (campaignTemplate === "task") {
      campaign = await generateTaskCampaign({
        name,
        description,
        totalAmount,
        rewardAmount,
        campaignTemplate,
        company,
        merchants,
        tags,
        publishPin,
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
        userId,
        triggerText,
        tags,
        publishPin,
      });
    } else if (campaignTemplate === "sampleGiveAway") {
      campaign = await generateSampleGiveAwayCampaign({
        name,
        description,
        totalAmount,
        rewardAmount,
        campaignTemplate,
        noOfSamples,
        company,
        merchants,
        tags,
        publishPin,
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
  tags,
  publishPin,
}) => {
  const campaign = await Campaign.create({
    name,
    description,
    status: "Pending",
    totalAmount,
    rewardAmount,
    campaignTemplate,
    company,
    publishPin: publishPin || generateRandomPin(),
    tags,
  });

  campaign.merchantRegistrationLink = `${process.env.FRONTEND_URL}/campaign/register-merchant/campaign=${campaign.id}&company=${company}`;
  await campaign.save();

  if (merchants && merchants.length > 0) {
    await Promise.all(
      merchants.map(async (merchant) => {
        const merchantObj =  await Merchant.create({
          merchantName: merchant.name,
          upiId: merchant.upiId,
          merchantMobile: merchant.mobileNumber,
          merchantEmail: merchant.email,
          campaign: campaign.id,
          company: company,
          address: merchant.address,
          qrLink:
            templateToLinkMap[campaignTemplate] || process.env.FRONTEND_URL,
        });
        await merchantObj.save();
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
  totalAmount,
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
    totalAmount,
    rewardAmount,
    triggerText,
    campaignTemplate,
    company,
    publishPin: publishPin || generateRandomPin(),
    tags,
  });

  const codes = new Set();
  const existingCodeDocs = await Code.find({}, { code: 1 });

  existingCodeDocs.forEach((doc) => codes.add(doc.code));

  const totalCodesToGenerate = Math.floor(totalAmount / rewardAmount);
  const prefix = "BOUNTY";

  const generatedCodes = [];
  while (generatedCodes.length < totalCodesToGenerate) {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const code = `${prefix}${randomNum}`;
    if (!codes.has(code)) {
      generatedCodes.push(code);
      codes.add(code);
    }
  }

  await qrCodeQueue.add("qrCodeGeneration", {
    companyId: company,
    campaignId: campaign.id,
    codes: generatedCodes,
    triggerText: triggerText,
    taskUrl: process.env.WHATSAPP_REDIRECT_URL + "/",
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
  totalAmount,
  rewardAmount,
  campaignTemplate,
  noOfSamples,
  company,
  merchants,
  tags,
  publishPin,
}) => {
  const campaign = await Campaign.create({
    name,
    description,
    status: "Pending",
    totalAmount,
    rewardAmount,
    campaignTemplate,
    company,
    publishPin: publishPin || generateRandomPin(),
    noOfSamples,
    tags,
  });

  campaign.merchantRegistrationLink = `${process.env.FRONTEND_URL}/campaign/register-merchant/campaign=${campaign.id}&company=${company}`;
  await campaign.save();

  if (merchants && merchants.length > 0) {
    await Promise.all(
      merchants.map(async (merchant) => {
        const merchantObj = await Merchant.create({
          merchantName: merchant.name,
          upiId: merchant.upiId,
          merchantMobile: merchant.mobileNumber,
          merchantEmail: merchant.email,
          campaign: campaign.id,
          company: company,
          address: merchant.address,
          qrLink: `${process.env.FRONTEND_URL}/qr/${merchant.id}`,
        });
        await merchantObj.save();
      })
    );
  }

  return campaign;
};
