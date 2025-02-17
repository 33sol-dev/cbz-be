// controllers/campaignCreator.js
const Merchant = require("../models/Merchant");
const Campaign = require("../models/Campaign");
const Code = require("../models/Code");
const qrCodeQueue = require("../queues/qrCodeQueue");
const { generateRandomPin } = require("../utils/pinGenerator");
const Company = require("../models/Company");
const { generateMerchantObject } = require("./merchantController");
const { validationResult } = require('express-validator');

/**
 * Generate a campaign based on the template type
 */
exports.generateCampaign = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

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

        // Validate required fields (already done by express-validator)

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
                triggerText,  // Ensure triggerText is passed
                company,
                merchants,
                taskUrl,
                tags,
                publishPin,
                userId,
                payoutConfig: req.body.payoutConfig
            });
        } else if (campaignTemplate === "product") {
             if (!triggerText) {
                return res.status(400).json({ message: "Missing triggerText for product campaign" });
            }
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
                triggerText, // Ensure triggerText is passed
                tags,
                publishPin,
            });
        } else if (campaignTemplate === "digital_activation") {
            campaign = await generateSampleGiveAwayCampaign({
                name,
                description,
                campaignTemplate,
                company,
                merchants,
                taskUrl,
                triggerText, // Ensure triggerText is passed
                taskType,
                tags,
                publishPin,
                userId
            });
        } else {
            return res.status(400).json({ message: "Invalid campaign template" });
        }

        return res.json({ campaign });
    } catch (err) {
        return res.status(500).json({ message: "Server error", error: err.toString() });
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
    triggerText, // Added
    taskUrl,
    taskType,
    tags,
    publishPin,
    userId,
    payoutConfig
}) => {
    if (payoutConfig) {
        if (typeof payoutConfig !== 'object' || payoutConfig === null) {
            throw new Error('payoutConfig must be an object');
        }
        // Convert to Map to validate structure
        const payoutConfigMap = new Map(Object.entries(payoutConfig));

        for (const [key, value] of payoutConfigMap) {
            if (typeof value !== 'object' || value === null ||
                typeof value.min !== 'number' || typeof value.max !== 'number' || typeof value.avg !== 'number') {
                throw new Error('Invalid payoutConfig structure');
            }
            if (value.min > value.avg || value.avg > value.max) {
                throw new Error('Invalid payoutConfig ranges (min <= avg <= max)');
            }
        }
    }
      const rewardConfig = {
          rewardType: "cashback", // Or determine dynamically
          payoutConfig: payoutConfig ? new Map(Object.entries(payoutConfig)) : new Map(), // Convert to Map
      };
    const campaign = await Campaign.create({
        name,
        description,
        status: "Ready",  // Task campaigns are ready immediately
        totalAmount,
        taskUrl,
        triggerText, // Use triggerText
        rewardAmount,
        taskConfig:{
            taskUrl,
            triggerText,
            taskType,
        },
        campaignTemplate,
        company,
        publishPin: publishPin || generateRandomPin(),
        tags,
        user: userId,
        rewardConfig

    });
    campaign.merchantRegistrationLink = `${process.env.MERCHANT_REGISTRATION_URL}?campaign=${campaign.id}&company=${company}`;
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
    triggerText, // Added
    tags,
    publishPin,
}) => {

    const campaign = await Campaign.create({
        name,
        description,
        status: "Pending", // Product campaigns start as pending
        taskType,
        rewardAmount,
        noOfSamples,
        triggerText, // Use triggerText
        campaignTemplate,
        company,
        publishPin: publishPin || generateRandomPin(),
        tags,
    });

    const codes = new Set();
    const existingCodeDocs = await Code.find({}, { code: 1 }).lean(); // Use lean()
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
    const companyData = await Company.findById(company);

    console.log("Generating These Codes in the Queue", generatedCodes);
    await qrCodeQueue.add("qrCodeGeneration", {
        companyId: company,
        campaignId: campaign.id,
        codes: generatedCodes,
        triggerText: triggerText, // Pass triggerText
        campaignTemplate,
        taskUrl: `https://wa.me/${companyData.phoneNumber}?text=`, // Dynamic URL
        mobileNumber: "0000000000", // Placeholder (consider making this dynamic)
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
    triggerText, // Added
    campaignTemplate,
    company,
    taskType,
    merchants,
    taskUrl,
    tags,
    publishPin,
    userId
}) => {

    console.log(`Creating Campaign for ${campaignTemplate} ${company}`);

    const campaign = await Campaign.create({
        taskType,
        name,
        description,
        triggerText, // Use triggerText
        taskUrl,
        status: "Ready",
        campaignTemplate,
        company,
        publishPin: publishPin || generateRandomPin(),
        tags,
    });
    campaign.merchantRegistrationLink = `${process.env.MERCHANT_REGISTRATION_URL}?campaign=${campaign.id}&company=${company}`;

    await campaign.save();
    console.log("Campaign Creation Successful");

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