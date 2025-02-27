// controllers/codeController.js
const Merchant = require("../models/Merchant");
const Campaign = require("../models/Campaign");
const Code = require("../models/Code");
const Customer = require("../models/Customer");
const Transaction = require("../models/Transaction");
const logger = require("../utils/logger");
const { initiateUPIPayout } = require("../utils/paymentService");
const { validationResult } = require("express-validator");

exports.redeemBounty = async (req, res) => {
  try {
    // 1) Validate request body
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { phoneNumber } = req.body;
    let rawText = req.body.code; // Contains trigger text and bounty code

    if (!phoneNumber || !rawText) {
      return res
        .status(400)
        .json({ message: "phoneNumber and code are required." });
    }

    // 2) Extract bounty code from rawText.
    // Assumes format: "triggerText-BOUNTY1234" (bounty code is after the last hyphen)
    let bountyCode = rawText;
    if (rawText.includes("-")) {
      bountyCode = rawText.split("-").pop().trim();
    }
    // bountyCode now should be something like "BOUNTY1234"

    // 3) Look up the bounty code record (reusable)
    const codeDoc = await Code.findOne({ code: bountyCode })
      .populate("campaign")
      .populate("merchant");
    if (!codeDoc) {
      return res.status(400).json({ message: "Invalid bounty code." });
    }

    // 4) Get the campaign and merchant from the code record
    const campaign = codeDoc.campaign;
    const merchant = codeDoc.merchant;

    // Ensure campaign is active
    if (campaign.status !== "Active") {
      return res
        .status(400)
        .json({ message: "Campaign is not active. Cannot redeem." });
    }

    // 5) Find or create the customer by phone number.
    // Also, if creating a new customer, record the merchant for tracking.
    let customer = await Customer.findOne({ phone_number: phoneNumber });
    if (!customer) {
      customer = await Customer.create({
        phone_number: phoneNumber,
        company: campaign.company,
        merchant: merchant ? merchant._id : undefined,
      });
    }

    // 6) Check if the customer has already participated in this campaign.
    const existingTxn = await Transaction.findOne({
      customer: customer._id,
      campaign: campaign._id,
      status: "SUCCESS",
    });
    if (existingTxn) {
      return res
        .status(200)
        .json({ message: "Customer already participated in this campaign." });
    }

    // 7) Decide reward based on campaignTemplate
    let merchantPayout = 0;
    let discountCodeToUser = null;
    let sampleCodeToUser = null;
    let moneyReceived = 0;

    if (campaign.campaignTemplate === "award") {
      // Calculate payout based on previous successful transactions
      const timesUsed = await Transaction.countDocuments({
        customer: customer._id,
        campaign: campaign._id,
        status: "SUCCESS",
      });
      logger.info(
        `Customer ${customer.phone_number} has redeemed ${timesUsed} time(s) for campaign ${campaign._id}.`
      );

      // Retrieve payout configuration.
      let payoutRange;
      if (campaign.rewardConfig && campaign.rewardConfig.payoutConfig) {
        if (typeof campaign.rewardConfig.payoutConfig.get === "function") {
          payoutRange = campaign.rewardConfig.payoutConfig.get(String(timesUsed + 1));
        } else {
          payoutRange = campaign.rewardConfig.payoutConfig[String(timesUsed + 1)];
        }
      }
      logger.info(
        `Payout configuration for usage count ${timesUsed + 1}: ${JSON.stringify(payoutRange)}`
      );

      let payoutAmt;
      if (payoutRange) {
        // Calculate payoutAmt ensuring it is within [min, max] and close to avg.
        payoutAmt = Math.min(
          payoutRange.max,
          Math.max(payoutRange.min, payoutRange.avg)
        );
        logger.info(`Calculated payout amount: ${payoutAmt}`);
      } else {
        payoutAmt =
          campaign.rewardConfig.bounty_cashback_config?.avg_amount ||
          campaign.rewardConfig.rewardAmount ||
          1;
        logger.info(`Fallback payout amount: ${payoutAmt}`);
      }

      // Process merchant payout if UPI is available.
      if (merchant && merchant.upiId) {
        try {
          await initiateUPIPayout(merchant.upiId, payoutAmt, merchant.merchantName);
          merchantPayout = payoutAmt;
          // Record a transaction for this payout.
          await Transaction.create({
            customer: customer._id,
            company: campaign.company,
            campaign: campaign._id,
            code: codeDoc._id,
            amount: payoutAmt,
            status: "SUCCESS",
          });
        } catch (err) {
          logger.error("Error during merchant payout:", err);
          return res
            .status(500)
            .json({ message: "Failed to disburse to merchant." });
        }
      } else {
        logger.warn("Merchant or UPI ID missing for award campaign.");
      }
      // For award campaigns, customer receives a discount code.
      discountCodeToUser = `DISC-${Math.floor(1000 + Math.random() * 9000)}`;
      moneyReceived = merchantPayout; // Money disbursed via payout.
    } else if (campaign.campaignTemplate === "digital_activation") {
      // For digital_activation, no merchant payout.
      sampleCodeToUser = `FREE-${Math.floor(1000 + Math.random() * 9000)}`;
      await Transaction.create({
        customer: customer._id,
        company: campaign.company,
        campaign: campaign._id,
        code: codeDoc._id,
        amount: 0,
        status: "SUCCESS",
      });
      moneyReceived = 0;
    } else if (campaign.campaignTemplate === "product") {
      return res
        .status(400)
        .json({ message: "Use the product flow or adapt accordingly." });
    } else {
      return res
        .status(400)
        .json({ message: "Invalid or unsupported campaign template." });
    }

    // 8) Update the customer's last_campaign_details so we can later fetch customers for a campaign.
    customer.last_campaign_details = {
      campaign_id: campaign._id,
      details_user_shared: {}, // Optionally add any shared details.
      money_they_received: moneyReceived,
    };
    await customer.save();

    // 9) Return a consolidated response.
    return res.json({
      message: "Redemption success!",
      merchantPayout,
      discountCode: discountCodeToUser,
      sampleCode: sampleCodeToUser,
    });
  } catch (error) {
    logger.error("Error in redeemBounty:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.toString() });
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