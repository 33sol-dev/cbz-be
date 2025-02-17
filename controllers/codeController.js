// controllers/codeController.js
const Merchant = require("../models/Merchant");
const Campaign = require("../models/Campaign");
const Code = require("../models/Code");
const Customer = require("../models/Customer");
const SampleCode = require("../models/SampleCode");
const Transaction = require("../models/Transaction");
const logger = require("../utils/logger");
const { generateUniqueCode } = require("../utils/generateUniqueCode");
const { initiateUPIPayout } = require("../utils/paymentService");
const { validationResult } = require('express-validator');

const validateUnique = async (campaign, customer) => {
  const transaction = await Transaction.findOne({ campaign, customer }).lean();
  return !transaction;
};

const processProduct = async (codeObj, customer) => {
    const campaign = await Campaign.findById(codeObj.campaign).lean();
    if (!campaign) throw new Error("Campaign not found");

    const { upiId, full_name } = customer;
    codeObj.isUsed = true;
    codeObj.usedBy = customer._id;
    codeObj.usedAt = new Date();
    await codeObj.save();


    await initiateUPIPayout(upiId, campaign.rewardAmount, full_name);
    return { message: "Reward Processed Successfully" };
};

// controllers/codeController.js
const processAward = async (codeObj, customer) => {
    const merchant = await Merchant.findById(codeObj.merchant).lean();
    const campaign = await Campaign.findById(codeObj.campaign).lean();
    if (!merchant || !campaign) throw new Error("Invalid campaign or merchant");

    if (await validateUnique(campaign._id, customer._id)) {
        // Count previous successful transactions for THIS merchant and campaign
        const timesUsed = await Transaction.countDocuments({
            campaign: campaign._id,
            customer: customer._id, //we should save merchants id on transaction to make it more practical
            status: "SUCCESS",
        });

        // Get the payout configuration for this usage count (timesUsed + 1)
        const payoutRange = campaign.payoutConfig && campaign.payoutConfig.get(String(timesUsed + 1));
        let amountToDisburse;

        if (payoutRange) {
            // Use configured min, max, and avg
            // Example logic:  Choose the average, but clamp it to the min/max
            amountToDisburse = Math.min(
                payoutRange.max,
                Math.max(payoutRange.min, payoutRange.avg)
            );
        } else {
            // Fallback:  Use a default or the campaign's rewardAmount if no config is found
            // You might want a more sophisticated fallback, like a default config.
            amountToDisburse = campaign.rewardAmount || 100; // Or some other default
        }


        console.log(`Paying ${merchant.merchantName} With ${amountToDisburse}`);
        await initiateUPIPayout(merchant.upiId, amountToDisburse, merchant.merchantName);

        // Create transaction record
        await Transaction.create({
            company: campaign.company,
            campaign: campaign._id,
            customer: customer._id,
            status: "SUCCESS",
            amount: amountToDisburse, // Store the actual amount disbursed
        });

        return { message: "Task Processed Successfully" };
    }
    return { message: "You are not eligible for this campaign" };
};

const processSample = async (codeObj, customer) => {
    if (await validateUnique(codeObj.campaign, customer._id)) {
        const uniqueCode = await generateUniqueCode();
        const campaignData = await Campaign.findById(codeObj.campaign);
        const transaction = await Transaction.create({
            company: campaignData.company,
            campaign: codeObj.campaign,
            customer: customer._id,
            status: "SUCCESS",
        });
        await transaction.save()

        const uniqueCodeObj = await SampleCode.create({
            samplerMobile: customer.phone_number,
            campaign: codeObj.campaign,
            code: uniqueCode,
            merchant: codeObj.merchant,
        });
        await uniqueCodeObj.save();

        return { message: `Sample Code Generated Successfully - ${uniqueCode}` };
    }
    return { message: "You are not eligible for this sample" };
};


const campaignConfig = {
  award: processAward,
  digital_activation: processSample,
  product: processProduct,
};

exports.processQrScan = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { number, text } = req.body;
        const code = text.substring(text.length - 12);

        const customer = await Customer.findOne({ phone_number: number }).lean();
        if (!customer) return res.json({ message: "Customer Does Not Exist" });

        const codeObj = await Code.findOne({ code }).populate("campaign");
        if (!codeObj) return res.json({ message: "Code is Not Valid" });

        if (codeObj.isUsed) return res.json({ message: "Code Has Been Already Used" });

        const campaignTemplate = codeObj.campaign.campaignTemplate;

        if (campaignConfig[campaignTemplate]) {
            const response = await campaignConfig[campaignTemplate](codeObj, customer);
            return res.json(response);
        }

        res.json({ message: "Invalid Campaign Type" });
    } catch (err) {
        logger.error("Error in processQrScan:", err);
        res.status(500).json({ message: "Server error", error: err.toString() });
    }
};



exports.getQrByCampaign = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { campaignId } = req.body;
        const codes = await Code.find({ campaign: campaignId }).lean();
        res.json({ codes });
    } catch (err) {
        logger.error("Error in getQrByCampaign:", err);
        res.status(500).json({ message: "Server error", error: err.toString() });
    }
};