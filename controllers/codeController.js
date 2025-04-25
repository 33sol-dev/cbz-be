// controllers/codeController.js
const Merchant      = require("../models/Merchant");
const Campaign      = require("../models/Campaign");
const Code          = require("../models/Code");
const Customer      = require("../models/Customer");
const Transaction   = require("../models/Transaction");
const logger        = require("../utils/logger");
const { initiateUPIPayout } = require("../utils/paymentService");
const { validationResult } = require("express-validator");

/* ------------------------------------------------------------------ */
/*  Redeem Bounty                                                     */
/* ------------------------------------------------------------------ */

exports.redeemBounty = async (req, res) => {
  try {
    /* -------------------------------------------------------------- */
    /* 1) Validate body                                               */
    /* -------------------------------------------------------------- */
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { phoneNumber } = req.body;
    let rawText = req.body.code;            // “triggerText-BOUNTYxxxx”

    if (!phoneNumber || !rawText) {
      return res.status(400).json({ message: "phoneNumber and code are required." });
    }

    /* -------------------------------------------------------------- */
    /* 2) Extract bounty code                                         */
    /* -------------------------------------------------------------- */
    let bountyCode = rawText.includes("-")
      ? rawText.split("-").pop().trim()
      : rawText;                            // e.g. “BOUNTY123456”

    /* -------------------------------------------------------------- */
    /* 3) Load Code, Campaign, Merchant                               */
    /* -------------------------------------------------------------- */
    const codeDoc = await Code.findOne({ code: bountyCode })
      .populate("campaign")
      .populate("merchant");

    if (!codeDoc) {
      return res.status(400).json({ message: "Invalid bounty code." });
    }

    const campaign = codeDoc.campaign;
    const merchant = codeDoc.merchant;      // may be undefined

    if (
      merchant &&
      merchant.campaign.toString() !== campaign._id.toString()
    ) {
      return res.status(400).json({ message: "Merchant does not belong to this campaign." });
    }

    if (campaign.status !== "Active") {
      return res.status(400).json({ message: "Campaign is not active. Cannot redeem." });
    }

    /* -------------------------------------------------------------- */
    /* 4) Find-or-create Customer & ENSURE proper merchant mapping    */
    /* -------------------------------------------------------------- */
    const thisMerchantId = merchant ? merchant._id : undefined;

    let customer = await Customer.findOne({ phone_number: phoneNumber });

    if (!customer) {
      // first-time customer – bind to this merchant
      customer = await Customer.create({
        phone_number : phoneNumber,
        company      : campaign.company,
        merchant     : thisMerchantId,
      });
    } else {
      // existing customer – overwrite merchant ONLY if different
      if (
        String(customer.merchant || "") !== String(thisMerchantId || "")
      ) {
        customer.merchant = thisMerchantId;
      }
    }

    /* -------------------------------------------------------------- */
    /* 5) Reject if already got reward in this campaign               */
    /* -------------------------------------------------------------- */
    const existingTxn = await Transaction.findOne({
      customer : customer._id,
      campaign : campaign._id,
      status   : "SUCCESS",
    });

    if (existingTxn) {
      return res.status(200).json({ message: "Customer already participated in this campaign." });
    }

    /* -------------------------------------------------------------- */
    /* 6) Templated reward logic                                      */
    /* -------------------------------------------------------------- */
    let merchantPayout     = 0;
    let discountCodeToUser = null;
    let sampleCodeToUser   = null;
    let moneyReceived      = 0;

    /* ----------  AWARD campaign (merchant cashback)  -------------- */
    if (campaign.campaignTemplate === "award") {
      const timesUsed = await Transaction.countDocuments({
        customer : customer._id,
        campaign : campaign._id,
        status   : "SUCCESS",
      });

      /* payoutConfig lookup */
      let payoutRange;
      if (campaign.rewardConfig && campaign.rewardConfig.payoutConfig) {
        payoutRange = typeof campaign.rewardConfig.payoutConfig.get === "function"
          ? campaign.rewardConfig.payoutConfig.get(String(timesUsed + 1))
          : campaign.rewardConfig.payoutConfig[String(timesUsed + 1)];
      }

      const payoutAmt = payoutRange
        ? Math.min(payoutRange.max, Math.max(payoutRange.min, payoutRange.avg))
        : (
            campaign.rewardConfig.bounty_cashback_config?.avg_amount ||
            campaign.rewardConfig.rewardAmount                    ||
            1
          );

      /* Skip payout if merchant paused */
      if (merchant && merchant.upiId) {
        if (merchant.status !== "active") {
          return res.status(200).json({
            message: "Merchant is paused; no cashback processed.",
            discountCode: null,
          });
        }

        try {
          await initiateUPIPayout(merchant.upiId, payoutAmt, merchant.merchantName);
          merchantPayout = payoutAmt;

          await Transaction.create({
            customer : customer._id,
            company  : campaign.company,
            campaign : campaign._id,
            code     : codeDoc._id,
            amount   : payoutAmt,
            status   : "SUCCESS",
          });
        } catch (err) {
          logger.error("Error during merchant payout:", err);
          return res.status(500).json({ message: "Failed to disburse to merchant." });
        }
      }

      discountCodeToUser = `DISC-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    /* ----------  DIGITAL ACTIVATION (sample)  --------------------- */
    else if (campaign.campaignTemplate === "digital_activation") {
      sampleCodeToUser = `FREE-${Math.floor(1000 + Math.random() * 9000)}`;

      await Transaction.create({
        customer : customer._id,
        company  : campaign.company,
        campaign : campaign._id,
        code     : codeDoc._id,
        amount   : 0,
        status   : "SUCCESS",
      });

      moneyReceived = 0;
    }

    /* ----------  PRODUCT (not handled here)  ---------------------- */
    else if (campaign.campaignTemplate === "product") {
      return res.status(400).json({ message: "Use the product flow or adapt accordingly." });
    }

    else {
      return res.status(400).json({ message: "Invalid or unsupported campaign template." });
    }

    /* -------------------------------------------------------------- */
    /* 7) Update customer.last_campaign_details                       */
    /* -------------------------------------------------------------- */
    customer.last_campaign_details = {
      campaign_id         : campaign._id,
      merchant_id         : thisMerchantId,          // ← helpful for CSV & UI
      details_user_shared : {},
      money_they_received : moneyReceived,
    };

    await customer.save();

    /* -------------------------------------------------------------- */
    /* 8) Respond                                                     */
    /* -------------------------------------------------------------- */
    return res.json({
      message       : "Redemption success!",
      merchantPayout,
      discountCode  : discountCodeToUser,
      sampleCode    : sampleCodeToUser,
    });

  } catch (error) {
    logger.error("Error in redeemBounty:", error);
    return res.status(500).json({ message: "Server error", error: error.toString() });
  }
};

/* ------------------------------------------------------------------ */
/*  Get all QR / Code docs for a campaign                             */
/* ------------------------------------------------------------------ */
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
