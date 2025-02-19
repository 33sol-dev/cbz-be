// controllers/campaignCreator.js
const Merchant = require("../models/Merchant");
const Campaign = require("../models/Campaign");
const Code = require("../models/Code");
const qrCodeQueue = require("../queues/qrCodeQueue");
const { generateRandomPin } = require("../utils/pinGenerator");
const Company = require("../models/Company");
const { generateMerchantObject } = require("./merchantController");
const { validationResult } = require('express-validator');

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
            taskType, // Get ALL taskConfig fields from req.body
            taskUrl,
            tags,
            payoutConfig // Get payoutConfig from req.body for award
        } = req.body;

        const publishPin = generateRandomPin();
        const companyData = await Company.findById(company);
        if (!companyData) {
            return res.status(404).json({ message: "Company not found" });
        }
        const userId = companyData.companyId;

        let campaign;
        let taskConfig = { taskType, taskUrl, triggerText }; // Centralized taskConfig

        // Handle different campaign templates
        if (campaignTemplate === "award") {
            campaign = await generateTaskCampaign({
                name,
                description,
                totalAmount,
                rewardAmount,
                campaignTemplate,
                company,
                merchants,
                taskConfig, // Pass the entire taskConfig object
                tags,
                publishPin,
                userId,
                payoutConfig //for award
            });
        } else if (campaignTemplate === "product") {
            if (!triggerText) {
                return res.status(400).json({ message: "Missing triggerText for product campaign" });
            }
             //For product campaign, we use taskURL as base and append code
             taskConfig.taskUrl = `${taskUrl}?code=`; // Prepare for code appending in worker
            campaign = await generateProductCampaign({
                name,
                description,
                totalAmount,
                rewardAmount,
                campaignTemplate,
                company,
                noOfSamples,
                userId,
                taskConfig, // Pass the entire taskConfig object
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
                taskConfig, // Pass the entire taskConfig object
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


const generateTaskCampaign = async ({
    name,
    description,
    totalAmount,
    rewardAmount,
    campaignTemplate,
    company,
    merchants,
    taskConfig, // Receive the complete taskConfig
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
        status: "Ready",
        totalAmount,
        taskConfig, // Use the complete taskConfig object
        rewardAmount,
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
                await generateMerchantObject({ //Pass task URL
                    merchantName: merchant.name,
                    upiId: merchant.upiId,
                    merchantMobile: merchant.mobileNumber,
                    merchantEmail: merchant.email,
                    company,
                    campaignTemplate: campaign.campaignTemplate,
                    address: merchant.address,
                    campaignId: campaign.id,
                    taskUrl: campaign.taskConfig.taskUrl, // Pass taskUrl here

                });
            })
        );
    }

    return campaign;
};

const generateProductCampaign = async ({
    name,
    description,
    taskConfig, // Receive taskConfig
    noOfSamples,
    rewardAmount,
    campaignTemplate,
    company,
    userId,
    tags,
    publishPin,
}) => {

    const campaign = await Campaign.create({
        name,
        description,
        status: "Pending",
        taskConfig, // Use the complete taskConfig
        rewardAmount,
        noOfSamples,
        campaignTemplate,
        company,
        publishPin: publishPin || generateRandomPin(),
        tags,
        user: userId,
    });

    const codes = new Set();
    const existingCodeDocs = await Code.find({}, { code: 1 }).lean();
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
    await qrCodeQueue.add("qrCodeGeneration", {
        companyId: company,
        campaignId: campaign.id,
        codes: generatedCodes,
        campaignTemplate,
        taskUrl: taskConfig.taskUrl, // Pass the campaign's taskUrl (now includes ?code=)
        mobileNumber: "0000000000",
        userId: userId,
    });

    return campaign;
};

const generateSampleGiveAwayCampaign = async ({
    name,
    description,
    campaignTemplate,
    company,
    taskConfig, // Receive taskConfig
    merchants,
    tags,
    publishPin,
    userId
}) => {


    const campaign = await Campaign.create({
        name,
        description,
        status: "Ready",
        campaignTemplate,
        company,
        taskConfig,  // Use the complete taskConfig
        publishPin: publishPin || generateRandomPin(),
        tags,
        user: userId,
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
                    company: company,
                    campaignTemplate,
                    address: merchant.address,
                    campaignId: campaign.id,
                    taskUrl: campaign.taskConfig.taskUrl, // Pass taskUrl
                });
            })
        );
    }

    return campaign;
};