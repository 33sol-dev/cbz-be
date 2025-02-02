const Merchant = require("../models/Merchant");
const Campaign = require("../models/Campaign");
const mongoose = require("mongoose");
const logger = require("../utils/logger"); // Ensure logger utility is imported

/**
 * Add a new merchant to a campaign (Allows same merchant in multiple campaigns)
 */
exports.addMerchant = async (req, res) => {
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

    // Validate required fields
    if (!merchantName || !upiId || !merchantMobile || !campaignId || !company) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Check if the campaign exists
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    // Create a new merchant entry for this campaign
    let merchant = await Merchant.create({
      merchantName,
      upiId,
      merchantMobile,
      merchantEmail,
      campaign: campaignId,
      company,
      address,
    });


    // Generate QR Link with Campaign and Merchant ID
    merchant.qrLink = `${process.env.TASK_URL}?campaign=${campaignId}&merchant=${merchant._id}`;
    await merchant.save();

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
  console.log(req.params)
  try {
    const campaignId = req.params.campaignId;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(campaignId)) {
      return res.status(400).json({ message: "Invalid campaign ID" });
    }

    const merchants = await Merchant.find({ campaign: campaignId });

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
  try {
    const merchantId = req.params.merchantId;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(merchantId)) {
      return res.status(400).json({ message: "Invalid merchant ID" });
    }

    const merchant = await Merchant.findById(merchantId);
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

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(merchantId)) {
      return res.status(400).json({ message: "Invalid merchant ID" });
    }

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
      { new: true }
    );

    if (!merchant) {
      return res.status(404).json({ message: "Merchant not found" });
    }

    // Regenerate QR Link after update
    merchant.qrLink = `${process.env.TASK_URL}?campaign=${merchant.campaign}&merchant=${merchant._id}`;
    await merchant.save();

    res
      .status(200)
      .json({ message: "Merchant updated successfully", merchant });
  } catch (err) {
    logger.error("Error in updateMerchant:", err);
    res.status(500).json({ message: "Server error", error: err.toString() });
  }
};

/**
 * Delete a merchant (Soft Delete)
 */
exports.deleteMerchant = async (req, res) => {
  try {
    const merchantId = req.params.merchantId;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(merchantId)) {
      return res.status(400).json({ message: "Invalid merchant ID" });
    }

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

    // Validate ObjectId
    if (
      !mongoose.Types.ObjectId.isValid(merchantId) ||
      !mongoose.Types.ObjectId.isValid(newCampaignId)
    ) {
      return res
        .status(400)
        .json({ message: "Invalid merchant or campaign ID" });
    }

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
    newMerchant.qrLink = `${process.env.TASK_URL}?campaign=${newCampaignId}&merchant=${newMerchant._id}`;
    await newMerchant.save();

    res
      .status(200)
      .json({
        message: "Merchant assigned to new campaign successfully",
        merchant: newMerchant,
      });
  } catch (err) {
    logger.error("Error in assignMerchantToCampaign:", err);
    res.status(500).json({ message: "Server error", error: err.toString() });
  }
};
