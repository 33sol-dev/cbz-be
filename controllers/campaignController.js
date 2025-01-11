// controllers/campaignController.js

const Campaign = require("../models/Campaign");
const Company = require("../models/Company");
const Code = require("../models/Code");
const logger = require("../utils/logger");
const qrCodeQueue = require("../queues/qrCodeQueue");
const customerOnboardingQueue = require("../queues/customerOnboardingQueue");
const { generateRandomPin } = require("../utils/pinGenerator"); // Function to generate random PIN
const Transaction = require("../models/Transaction");
const Beneficiary = require("../models/Beneficiary");


const urlMaps = {
  "award": "https://wa.me/564066380115747/?text=",
  "digital": "https://t.me/",
  "video": "http://localhost:3000/video/",
}

exports.createCampaign = async (req, res) => {
  let {
    companyId,
    name,
    description,
    totalAmount,
    tags,
    triggerType,
    beneficiary,
    numberOfCodes,
    qrStyle,
    campaignType,
    logoUrl,
    reward_type,
    bounty_cashback_config,
    customFieldConfig,
    triggerText,
  } = req.body;

  try {
    // Validate required fields
    if (!companyId || !name || !numberOfCodes || !qrStyle) {
      return res.status(400).json({
        message: "companyId, name, numberOfCodes, and qrStyle are required.",
      });
    }
    logger.info("Campaign Type:", req.body);
    // Validate triggerType
    if (!["QR", "Excel"].includes(triggerType)) {
      return res
        .status(400)
        .json({ message: 'Invalid triggerType. Must be "QR" or "Excel".' });
    }

    // Validate qrStyle
    if (!["simple", "stylized"].includes(qrStyle)) {
      return res
        .status(400)
        .json({ message: 'Invalid qrStyle. Must be "simple" or "stylized".' });
    }

    // If qrStyle is stylized, logoUrl is required
    if (qrStyle === "stylized" && !logoUrl) {
      return res
        .status(400)
        .json({ message: "logoUrl is required for stylized QR codes." });
    }

    // Parse numberOfCodes to integer
    const numCodes = parseInt(numberOfCodes, 10);
    if (isNaN(numCodes) || numCodes <= 0) {
      return res.status(400).json({ message: "Invalid number of codes." });
    }

    // Find the company associated with the user
    const userCompany = await Company.findOne({
      _id: companyId,
      user: req.user.id,
    });

    if (!userCompany) {
      return res
        .status(404)
        .json({ message: "Company not found or access denied." });
    }

    logger.info("User Company:", userCompany);

    // Check QR code balance
    const qrCodeBalance = userCompany.qrCodeBalance;

    if (numCodes > qrCodeBalance) {
      return res.status(400).json({
        message: `You have exceeded your QR code balance. Available: ${qrCodeBalance}, Requested: ${numCodes}`,
      });
    }

    // Determine the mobile number to use
    let mobileNumber;

    if (userCompany.whatsappNumber) {
      // Use company's own WhatsApp number
      mobileNumber = userCompany.whatsappNumber;
    } else {
      const defaultWhatsAppNumbersEnv = process.env.DEFAULT_WHATSAPP_NUMBERS;
      let defaultNumbers = [];

      if (
        defaultWhatsAppNumbersEnv &&
        defaultWhatsAppNumbersEnv.trim() !== ""
      ) {
        if (defaultWhatsAppNumbersEnv.includes(",")) {
          defaultNumbers = defaultWhatsAppNumbersEnv
            .split(",")
            .map((number) => number.trim());
        } else {
          defaultNumbers = [defaultWhatsAppNumbersEnv.trim()];
        }
      }

      if (defaultNumbers.length === 0) {
        return res
          .status(400)
          .json({ message: "No default WhatsApp numbers configured." });
      }

      mobileNumber =
        defaultNumbers[Math.floor(Math.random() * defaultNumbers.length)];
    }

    // Parse customFieldConfig if provided
    if (typeof customFieldConfig === "string") {
      customFieldConfig = JSON.parse(customFieldConfig);
    }

    // Validate customFieldConfig if provided
    if (customFieldConfig) {
      if (!Array.isArray(customFieldConfig)) {
        return res
          .status(400)
          .json({ message: "customFieldConfig must be an array" });
      }

      for (const field of customFieldConfig) {
        if (!field.fieldName) {
          return res
            .status(400)
            .json({ message: "Each custom field must have a fieldName" });
        }
      }
    }
    var id = null;
    if(beneficiary){
      const { beneficiaryName, beneficiaryMobile, beneficiaryEmail, upiId } = beneficiary;
      const beneFiciary = await Beneficiary.create({
        beneficiaryName: beneficiaryName,
        upiId: upiId,
        beneficiaryMobile: beneficiaryMobile,
        beneficiaryEmail: beneficiaryEmail,
      });
      id = beneFiciary._id;
    }


    const publishPin = generateRandomPin();
    logger.info(publishPin);
    // Create the campaign
    const campaign = new Campaign({
      user: req.user.id,
      company: companyId,
      name,
      description,
      totalAmount,
      tags,
      beneficiary:id,
      status: "Pending",
      reward_type,
      bounty_cashback_config,
      customFieldConfig,
      triggerText,
      publishPin: publishPin,
    });

    // Generate default payoutConfig based on bounty_cashback_config
    if (bounty_cashback_config && reward_type === "cashback") {
      const { avg_amount, max_amount, min_amount } = bounty_cashback_config;

      campaign.payoutConfig = {
        1: max_amount,
        2: avg_amount,
        default: min_amount,
      };
    }

    await campaign.save(); // Save the campaign before processing

    // Generate unique codes
    const codes = [];
    const existingCodes = new Set();

    // Fetch existing codes once
    const existingCodeDocs = await Code.find({}, { code: 1 });
    existingCodeDocs.forEach((doc) => existingCodes.add(doc.code));

    const totalCodesToGenerate = numCodes;
    const prefix = "BOUNTY";

    while (codes.length < totalCodesToGenerate) {
      const randomNum = Math.floor(10000 + Math.random() * 90000); // Generate a 5-digit number
      const code = `${prefix}${randomNum}`;
      if (!existingCodes.has(code)) {
        codes.push(code);
        existingCodes.add(code); // Add to the set to avoid duplicates in this batch
      }
    }
    console.log(codes, "codes");
    console.log(triggerType, "Triggers");
    if (triggerType === "Excel") {
      // Ensure file is uploaded
      if (!req.file || !req.file.path) {
        return res
          .status(400)
          .json({ message: "CSV file is required for Excel trigger type." });
      }
      logger.info("JBJBJ" + campaign._id);
      // Enqueue the customer onboarding job with codes
      await customerOnboardingQueue.add("customerOnboarding", {
        companyId,

        campaignId: campaign._id,
        csvFilePath: req.file.path,
        userId: req.user.id,
        codes, // Pass the generated codes
      });
    } else if (triggerType === "QR") {
      // Enqueue the QR code generation job
      await qrCodeQueue.add("qrCodeGeneration", {
        companyId,
        campaignId: campaign._id,
        codes,
        taskUrl: urlMaps[campaignType],
        triggerText,
        mobileNumber,
        qrStyle,
        logoUrl,
        userId: req.user.id,
      });
    } else {
      return res.status(400).json({ message: "Invalid triggerType." });
    }

    res.status(201).json({
      message: "Campaign creation initiated successfully.",
      campaign,
      triggerType,
    });
  } catch (err) {
    logger.error("Error in createCampaign:", err);
    res.status(500).json({ message: "Server Error", error: err.toString() });
  }
};

exports.getCampaigns = async (req, res) => {
  try {
    logger.info("Fetching campaigns for user ID:", req.user);
    const campaigns = await Campaign.find({ user: req.user.id }).populate(
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

    if (!campaign || campaign.user.toString() !== req.user.id) {
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
    if (!campaign || campaign.user.toString() !== req.user.id) {
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
    if (!campaign || campaign.user.toString() !== req.user.id) {
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
    if (!campaign || campaign.user.toString() !== req.user.id) {
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
    if (!campaign || campaign.user.toString() !== req.user.id) {
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

exports.addBeneficiary = async (req, res) => {
  const campaignId = req.params.campaignId;
  const { mobileNumber, name, upiId, email } = req.body;

  try {
    const campaign = await Campaign.findById(campaignId);

    const beneFiciary = await Beneficiary.create({
      beneficiaryName: name,
      upiId: upiId,
      beneficiaryMobile: mobileNumber,
      beneficiaryEmail: email,
    });

    campaign.beneficiary = beneFiciary.id;
    await campaign.save();

    res.json({ message: "Beneficiary added successfully", campaign });
  } catch (err) {
    logger.error("Error in addBeneficiary:", err);
    res.status(500).json({ message: "Server error", error: err.toString() });
  }
};



