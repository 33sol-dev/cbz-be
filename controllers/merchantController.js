// controllers/merchantController.js
const Merchant = require("../models/Merchant");
const Campaign = require("../models/Campaign");
const mongoose = require("mongoose");
const logger = require("../utils/logger");
const { generateUniqueCode } = require("../utils/generateUniqueCode");
const Code = require("../models/Code");
const constants = require("../config/constants")
const { validationResult } = require('express-validator');

exports.generateMerchantObject = async ({
    merchantName,
    upiId,
    merchantMobile,
    merchantEmail,
    company,
    address,
    campaignId,
    campaignTemplate
  }) => {
    try {
      const codeString = await generateUniqueCode();
      let merchant = await Merchant.create({
        merchantName,
        upiId,
        merchantMobile,
        merchantEmail,
        campaign: campaignId,
        company,
        address,
      });

      const merchantCode = await Code.create({
        code: codeString,
        company:company,
        campaign: campaignId,
        campaignTemplate:campaignTemplate,
        merchant: merchant._id,
      });
      await merchantCode.save();

      merchant.qrLink = `${constants.taskUrl}?campaign=${campaignId}&merchant=${merchant._id}`;
      merchant.merchantCode = merchantCode.id;
      await merchant.save();
      return merchant;
    } catch (err) {
      logger.error("Error generating merchant object");
      console.log(err)
      throw new Error("Failed to generate merchant object");
    }
  };

/**
 * Add a new merchant to a campaign (Allows same merchant in multiple campaigns)
 */
exports.addMerchant = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const {
            merchantName,
            upiId,
            merchantMobile,
            merchantEmail,
            company,
            address,
            campaignId,
        } = req.body;

        // Input validation (already handled by express-validator)
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({ message: "Campaign not found" });
        }

        const merchant = await exports.generateMerchantObject({
            merchantName,
            upiId,
            merchantMobile,
            merchantEmail,
            company,
            campaignTemplate: campaign.campaignTemplate,
            address,
            campaignId,
        });
        res.status(201).json({ message: "Merchant added successfully", merchant });
    } catch (err) {
        logger.error("Error in addMerchant:", err);
        res.status(500).json({ message: "Server error", error: err.toString() });
    }
};

/**
 * Get all merchants of a campaign
 */
exports.getMerchants = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    console.log(req.params);
    try {
        const campaignId = req.params.campaignId;

        const merchants = await Merchant.find({ campaign: campaignId }).populate({
            path: "merchantCode",
            model: "Code" // Ensure this matches your schema reference
          }).lean();

        res.status(200).json({ merchants });
    } catch (err) {
        logger.error("Error in getMerchants:", err);
        res.status(500).json({ message: "Server error", error: err.toString() });
    }
};

/**
 * Get a merchant by ID
 */
exports.getMerchant = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const merchantId = req.params.merchantId;

        const merchant = await Merchant.findById(merchantId).populate({path: "merchantCode",model: "Code"}).lean(); //Added Lean
        if (!merchant) {
            return res.status(404).json({ message: "Merchant not found" });
        }
        res.status(200).json({ merchant });
    } catch (err) {
        logger.error("Error in getMerchant:", err);
        res.status(500).json({ message: "Server error", error: err.toString() });
    }
};

/**
 * Update a merchant's details
 */
exports.updateMerchant = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const merchantId = req.params.merchantId;
        const {
            merchantName,
            upiId,
            merchantMobile,
            merchantEmail,
            campaign,
            company,
            address,
        } = req.body;

        const merchant = await Merchant.findByIdAndUpdate(
            merchantId,
            {
                merchantName,
                upiId,
                merchantMobile,
                merchantEmail,
                campaign,
                company,
                address,
            },
            { new: true, runValidators: true } // Added runValidators
        );

        if (!merchant) {
            return res.status(404).json({ message: "Merchant not found" });
        }

        // Regenerate QR Link after update (consider moving this to a post-save hook)
        merchant.qrLink = `${constants.taskUrl}?campaign=${merchant.campaign}&merchant=${merchant._id}`;
        await merchant.save();

        res.status(200).json({ message: "Merchant updated successfully", merchant });
    } catch (err) {
        logger.error("Error in updateMerchant:", err);
        res.status(500).json({ message: "Server error", error: err.toString() });
    }
};

/**
 * Delete a merchant (Soft Delete)
 */
exports.deleteMerchant = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const merchantId = req.params.merchantId;

        const merchant = await Merchant.findByIdAndDelete(merchantId);
        if (!merchant) {
            return res.status(404).json({ message: "Merchant not found" });
        }
        res.status(200).json({ message: "Merchant deleted successfully" });
    } catch (err) {
        logger.error("Error in deleteMerchant:", err);
        res.status(500).json({ message: "Server error", error: err.toString() });
    }
};

/**
 * Assign an existing merchant to a new campaign (Creates a new entry for the new campaign)
 */
exports.assignMerchantToCampaign = async (req, res) => {

    try {
        const { merchantId, newCampaignId } = req.body;

        // Check if the new campaign exists
        const newCampaign = await Campaign.findById(newCampaignId);
        if (!newCampaign) {
            return res.status(404).json({ message: "New campaign not found" });
        }

        const merchant = await Merchant.findById(merchantId);
        if (!merchant) {
            return res.status(404).json({ message: "Merchant not found" });
        }

        // Create a new merchant entry for the new campaign
        let newMerchant = await Merchant.create({
            merchantName: merchant.merchantName,
            upiId: merchant.upiId,
            merchantMobile: merchant.merchantMobile,
            merchantEmail: merchant.merchantEmail,
            campaign: newCampaignId,
            company: merchant.company,
            address: merchant.address,
        });

        // Generate a new QR Link for this campaign
        newMerchant.qrLink = `${constants.taskUrl}?campaign=${newCampaignId}&merchant=${newMerchant._id}`;
        await newMerchant.save();

        res.status(200).json({
            message: "Merchant assigned to new campaign successfully",
            merchant: newMerchant,
        });
    } catch (err) {
        logger.error("Error in assignMerchantToCampaign:", err);
        res.status(500).json({ message: "Server error", error: err.toString() });
    }
};