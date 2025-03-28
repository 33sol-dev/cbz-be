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
    campaignTemplate,
    taskUrl, // Receive taskUrl if needed
    isDummy,   // New parameter to indicate dummy creation
  }) => {
    try {
      const codeString = await generateUniqueCode();

      // If creating a dummy merchant, assign default values where needed
      if (isDummy) {
        merchantName = merchantName || "Dummy Merchant";
        upiId = upiId || ""; // or a default dummy UPI value if applicable
        merchantMobile = merchantMobile || "";
        merchantEmail = merchantEmail || "";
        address = address || "";
      }

      // Create the merchant document with the isDummy flag
      let merchant = await Merchant.create({
        merchantName,
        upiId,
        merchantMobile,
        merchantEmail,
        campaign: campaignId,
        company,
        address,
        isDummy, // set dummy flag
      });

      const merchantCode = await Code.create({
        code: codeString,
        company: company,
        campaign: campaignId,
        campaignTemplate: campaignTemplate,
        merchant: merchant._id,
      });
      await merchantCode.save();

      merchant.qrLink = `${process.env.FRONTEND_URL}/video?campaign=${campaignId}&merchant=${merchant._id}&code=${codeString}`;
      merchant.merchantCode = codeString;
      await merchant.save();

      return merchant;
    } catch (err) {
      logger.error("Error generating merchant object");
      console.log(err);
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
            isDummy, // read the new flag from the request body
        } = req.body;

        // Validate campaign existence as before
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({ message: "Campaign not found" });
        }

        // Pass the isDummy flag to generateMerchantObject
        const merchant = await exports.generateMerchantObject({
            merchantName,
            upiId,
            merchantMobile,
            merchantEmail,
            company,
            campaignTemplate: campaign.campaignTemplate,
            address,
            campaignId,
            isDummy, // new parameter
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

        const merchants = await Merchant.find({ campaign: campaignId }).lean();


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

        const merchant = await Merchant.findById(merchantId).lean();
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
// controllers/merchantController.js

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
            status  // new field to update status (e.g., "active" or "paused")
        } = req.body;
        
        // Find the merchant first
        let merchant = await Merchant.findById(merchantId);
        if (!merchant) {
            return res.status(404).json({ message: "Merchant not found" });
        }
  
        // Update each field explicitly if provided, else keep existing value
        merchant.merchantName = merchantName !== undefined ? merchantName : merchant.merchantName;
        merchant.upiId = upiId !== undefined ? upiId : merchant.upiId;
        merchant.merchantMobile = merchantMobile !== undefined ? merchantMobile : merchant.merchantMobile;
        merchant.merchantEmail = merchantEmail !== undefined ? merchantEmail : merchant.merchantEmail;
        merchant.campaign = campaign !== undefined ? campaign : merchant.campaign;
        merchant.company = company !== undefined ? company : merchant.company;
        merchant.address = address !== undefined ? address : merchant.address;
        merchant.status = status !== undefined ? status : merchant.status;
  
        // If the merchant was created as a dummy and now has valid details, unset the dummy flag.
        if (merchant.isDummy && merchantName && upiId && merchantMobile) {
            merchant.isDummy = false;
        }
  
        // Regenerate QR Link after update (if needed)
        merchant.qrLink = `${constants.taskUrl}?campaign=${merchant.campaign}&merchant=${merchant._id}`;
        
        // Save updated document
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