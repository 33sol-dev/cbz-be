// controllers/campaignController.js

const Campaign = require("../models/Campaign");
const logger = require("../utils/logger");
const Transaction = require("../models/Transaction");
const Merchant = require("../models/Merchant");


exports.getCampaigns = async (req, res) => {
  try {
    logger.info("Fetching campaigns for user ID:", req.query);
    const campaigns = await Campaign.find({ company: req.query.companyId }).populate(
      "company"
    );
    logger.info("Found campaigns:", campaigns);
    res.json({ campaigns });
  } catch (err) {
    logger.error("Error in getCampaigns:", err);
    res.status(500).send("Server Error");
  }
};
// controllers/campaignController.js
exports.getCampaignById = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const campaign = await Campaign.findById(campaignId);

    if (!campaign) {
      return res
        .status(404)
        .json({ message: "Campaign not found or access denied" });
    }

    res.json({ campaign });
  } catch (err) {
    logger.error("Error in getCampaignById:", err);
    res.status(500).json({ message: "Server Error", error: err.toString() });
  }
};

exports.getCampaignInsights = async (req, res) => {
  const campaignId = req.params.campaignId;

  try {
    const campaign = await Campaign.findById(campaignId).populate("company");
    if (!campaign) {
      return res
        .status(404)
        .json({ message: "Campaign not found or access denied" });
    }

    const transactions = await Transaction.find({ campaign: campaignId });
    const totalCashbackGiven = transactions.reduce(
      (total, txn) => total + txn.amount,
      0
    );
    const totalUsers = transactions.length;

    const insights = {
      totalCashbackGiven,
      totalUsers,
      averageCashbackPerUser: totalUsers
        ? (totalCashbackGiven / totalUsers).toFixed(2)
        : 0,
    };

    res.json({ campaign, insights });
  } catch (err) {
    logger.error("Error in getCampaignInsights:", err);
    res.status(500).json({ message: "Server error", error: err.toString() });
  }
};

exports.publishCampaign = async (req, res) => {
  const campaignId = req.params.campaignId;
  const { pin } = req.body; // The 4-digit PIN

  try {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res
        .status(404)
        .json({ message: "Campaign not found or access denied" });
    }

    if (campaign.status !== "Ready") {
      return res
        .status(400)
        .json({ message: "Campaign is not ready to be published." });
    }
    logger.info(pin);

    // Verify the PIN (for now, you can hardcode the PIN or store it in the campaign)
    const correctPin = campaign.publishPin; // Assume you have stored the PIN in the campaign
    logger.info(correctPin);
    if (pin !== correctPin) {
      return res.status(400).json({ message: "Invalid PIN." });
    }

    campaign.status = "Active";
    await campaign.save();

    res.json({ message: "Campaign published successfully", campaign });
  } catch (err) {
    logger.error("Error in publishCampaign:", err);
    res.status(500).json({ message: "Server error", error: err.toString() });
  }
};

exports.updatePayoutConfig = async (req, res) => {
  const campaignId = req.params.campaignId;
  const { payoutConfig } = req.body;

  try {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res
        .status(404)
        .json({ message: "Campaign not found or access denied" });
    }

    campaign.payoutConfig = payoutConfig;
    await campaign.save();

    res.json({
      message: "Payout configuration updated successfully",
      campaign,
    });
  } catch (err) {
    logger.error("Error in updatePayoutConfig:", err);
    res.status(500).json({ message: "Server error", error: err.toString() });
  }
};

exports.getCampaignSummary = async (req, res) => {
  const campaignId = req.params.campaignId;

  try {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res
        .status(404)
        .json({ message: "Campaign not found or access denied" });
    }

    const transactions = await Transaction.find({ campaign: campaignId });
    const totalCashbackGiven = transactions.reduce(
      (total, txn) => total + txn.amount,
      0
    );
    const totalUsers = transactions.length;

    const summary = `Your campaign "${campaign.name}" reached ${totalUsers} users and disbursed a total of Rs.${totalCashbackGiven} in cashback. The average cashback per user was Rs.${(
      totalCashbackGiven / totalUsers
    ).toFixed(
      2
    )}. Consider increasing engagement by offering higher rewards to first-time users.`;

    res.json({ summary });
  } catch (err) {
    logger.error("Error in getCampaignSummary:", err);
    res.status(500).json({ message: "Server error", error: err.toString() });
  }
};

exports.addMerchant = async (req, res) => {
  const campaignId = req.params.campaignId;
  const { mobileNumber, name, upiId, email } = req.body;

  try {
    const campaign = await Campaign.findById(campaignId);

    const merchant = await Merchant.create({
      merchantName: name,
      upiId: upiId,
      merchantMobile: mobileNumber,
      merchantEmail: email,
    });

    campaign.merchant = merchant.id;
    await campaign.save();

    res.json({ message: "Merchant added successfully", campaign });
  } catch (err) {
    logger.error("Error in addMerchant:", err);
    res.status(500).json({ message: "Server error", error: err.toString() });
  }
};



