// controllers/campaignController.js
const Campaign = require("../models/Campaign");
const logger = require("../utils/logger");
const Transaction = require("../models/Transaction");
const Merchant = require("../models/Merchant");
const { validationResult } = require('express-validator');
const { parse } = require('json2csv'); // Add this import at the top


// Helper function to get campaigns (DRY principle)
const getCampaignsHelper = async (query) => {
    return await Campaign.find(query).populate("company").lean();
};

exports.getCampaigns = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        logger.info("Fetching campaigns for user ID:", req.query);
        const campaigns = await getCampaignsHelper({ company: req.query.companyId });
        logger.info("Found campaigns:", campaigns.length);
        res.json({ campaigns });
    } catch (err) {
        logger.error("Error in getCampaigns:", err);
        res.status(500).send("Server Error");
    }
};

exports.getCampaignById = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { campaignId } = req.params;
        const campaign = await Campaign.findById(campaignId).populate("company").lean();
        if (!campaign) {
            return res.status(404).json({ message: "Campaign not found" });
        }
        res.json({ campaign });
    } catch (err) {
        logger.error("Error in getCampaignById:", err);
        res.status(500).json({ message: "Server Error", error: err.toString() });
    }
};

exports.getCampaignInsights = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const campaignId = req.params.campaignId;
    try {
        const campaign = await Campaign.findById(campaignId).populate("company").lean();
        if (!campaign) {
            return res.status(404).json({ message: "Campaign not found" });
        }

        const transactions = await Transaction.find({ campaign: campaignId }).lean();
        const totalCashbackGiven = transactions.reduce((total, txn) => total + txn.amount, 0);
        const totalUsers = transactions.length;

        const insights = {
            totalCashbackGiven,
            totalUsers,
            averageCashbackPerUser: totalUsers ? (totalCashbackGiven / totalUsers).toFixed(2) : 0,
        };
        res.json({ campaign, insights });
    } catch (err) {
        logger.error("Error in getCampaignInsights:", err);
        res.status(500).json({ message: "Server error", error: err.toString() });
    }
};

exports.publishCampaign = async (req, res) => {
    const errors = validationResult(req);
    // controllers/campaignController.js (continued)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
  }

  const campaignId = req.params.campaignId;
  const { pin } = req.body; // The 4-digit PIN

  try {
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
          return res.status(404).json({ message: "Campaign not found" });
      }

      if (campaign.status === "Pending") {
          return res.status(400).json({ message: "Campaign is not ready to be published." });
      }

      logger.info(`Provided PIN: ${pin}, Correct PIN: ${campaign.publishPin}`);

      // Verify the PIN
      if (pin !== campaign.publishPin) {
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


exports.getCampaignSummary = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
  }

  const campaignId = req.params.campaignId;
  try {
      const campaign = await Campaign.findById(campaignId).lean();
      if (!campaign) {
          return res.status(404).json({ message: "Campaign not found" });
      }

      const transactions = await Transaction.find({ campaign: campaignId }).lean();
      const totalCashbackGiven = transactions.reduce((total, txn) => total + txn.amount, 0);
      const totalUsers = transactions.length;

      const summary = `Your campaign "${campaign.name}" reached ${totalUsers} users and disbursed a total of Rs.${totalCashbackGiven} in cashback. The average cashback per user was Rs.${(totalCashbackGiven / totalUsers).toFixed(2)}. Consider increasing engagement by offering higher rewards to first-time users.`;
      res.json({ summary });
  } catch (err) {
      logger.error("Error in getCampaignSummary:", err);
      res.status(500).json({ message: "Server error", error: err.toString() });
  }
};
// controllers/campaignController.js

exports.getCampaignKPIs = async (req, res) => {
    const { campaignId } = req.params;
  
    try {
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
  
      const totalMerchants = await Merchant.countDocuments({ campaign: campaignId });
      const totalCustomers = await Customer.countDocuments({ 'last_campaign_details.campaign_id': campaignId });
      const totalMoneyGiven = await Transaction.aggregate([
          { $match: { campaign: mongoose.Types.ObjectId(campaignId), status: "SUCCESS" } },
          { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);
  
      const kpis = {
        totalMerchants,
        totalCustomers,
        totalMoneyGiven: totalMoneyGiven.length > 0 ? totalMoneyGiven[0].total : 0,
        // Add other KPIs as needed
      };
  
      res.json({ kpis });
  
    } catch (err) {
      logger.error("Error in getCampaignKPIs:", err);
      res.status(500).json({ message: "Server Error", error: err.toString() });
    }
  };
  

exports.addMerchant = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
  }

  const campaignId = req.params.campaignId;
  const { mobileNumber, name, upiId, email } = req.body;

  try {
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
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


exports.getCampaignMerchantsCSV = async (req, res) => {
  const { campaignId } = req.params;

  try {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    const merchants = await Merchant.find({ campaign: campaignId }).lean();

    if (merchants.length === 0) {
      return res.status(404).json({ message: "No merchants found for this campaign" });
    }

    const fields = ['merchantName', 'upiId', 'merchantMobile', 'merchantEmail', 'address']; // Add other fields as needed
    const opts = { fields };

    try {
      const csv = parse(merchants, opts);
      res.setHeader('Content-disposition', `attachment; filename=merchants_${campaignId}.csv`);
      res.set('Content-Type', 'text/csv');
      res.status(200).send(csv);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error generating CSV", error: err.toString() });
    }

  } catch (err) {
    logger.error("Error in getCampaignMerchantsCSV:", err);
    res.status(500).json({ message: "Server Error", error: err.toString() });
  }
};


exports.getCampaignCustomersCSV = async (req, res) => {
    const { campaignId } = req.params;
  
    try {
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
  
        const customers = await Customer.find({ 'last_campaign_details.campaign_id': campaignId }).lean();
  
      if (customers.length === 0) {
        return res.status(404).json({ message: "No customers found for this campaign" });
      }
  
      const fields = ['full_name', 'phone_number', 'upiId', 'email', 'address']; // Add or remove fields
      const opts = { fields };
  
      try {
        const csv = parse(customers, opts);
        res.setHeader('Content-disposition', `attachment; filename=customers_${campaignId}.csv`);
        res.set('Content-Type', 'text/csv');
        res.status(200).send(csv);
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error generating CSV", error: err.toString() });
      }
  
    } catch (err) {
      logger.error("Error in getCampaignCustomersCSV:", err);
      res.status(500).json({ message: "Server Error", error: err.toString() });
    }
  };