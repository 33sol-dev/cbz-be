const Viewer = require("../models/Viewer");
const Merchant = require("../models/Merchant");
const Campaign = require("../models/Campaign");
const axios = require("axios");
const logger = require("../utils/logger");

const CASHFREE_CLIENT_ID = process.env.CASHFREE_CLIENT_ID;
const CASHFREE_CLIENT_SECRET = process.env.CASHFREE_CLIENT_SECRET;
const CASHFREE_PAYOUT_URL = process.env.CASHFREE_PAYOUT_URL; // Base API URL

/**
 * Process task completion request and transfer money via Cashfree
 */
exports.processTask = async (req, res) => {
  try {
    console.log(req.body);
    const { macAddress, merchantId, campaignId } = req.body;

    // Validate required fields
    if (!macAddress || !merchantId || !campaignId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Check if campaign exists
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    // Check if the user has already completed this task
    const existingViewer = await Viewer.findOne({ campaign: campaignId, viewerMacAddress: macAddress });
    if (existingViewer) {
      return res.status(400).json({ message: "Task already completed by this device" });
    }

    // Fetch merchant details
    const merchant = await Merchant.findById(merchantId);
    if (!merchant) {
      return res.status(404).json({ message: "Merchant not found" });
    }

    if (!merchant.upiId || !merchant.merchantMobile) {
      return res.status(400).json({ message: "Merchant UPI ID or phone number is missing" });
    }

    // Ensure campaign has enough funds
    if (campaign.rewardAmount > campaign.totalAmount) {
      return res.status(400).json({ message: "Insufficient campaign funds" });
    }

    console.log("Sending Money To Merchant:", merchant.merchantName, merchant.merchantMobile, merchant.upiId, campaign.rewardAmount);

    // Initiate Cashfree Transfer
    const transferResponse = await initiateCashfreePayout({
      amount: campaign.rewardAmount,
      upiId: merchant.upiId,
      merchantName: merchant.merchantName,
      merchantMobile: merchant.merchantMobile,
    });

    if (!transferResponse.success) {
      return res.status(500).json({ message: "Cashfree transfer failed", error: transferResponse.error });
    }

    // Deduct reward amount from campaign's total amount
    campaign.totalAmount -= campaign.rewardAmount;
    await campaign.save();

    // Log the task completion
    const viewer = new Viewer({
      campaign: campaignId,
      merchant: merchantId,
      viewerMacAddress: macAddress,
      viewerMobile: merchant.merchantMobile,
    });

    await viewer.save();

    res.status(200).json({
      message: "Task completed successfully",
      transactionId: transferResponse.transactionId,
      merchant: merchant.merchantName,
      amountTransferred: campaign.rewardAmount,
    });
  } catch (err) {
    logger.error("Error in processTask:", err);
    res.status(500).json({ message: "Server error", error: err.toString() });
  }
};

/**
 * Function to initiate a UPI payout via Cashfree
 */
async function initiateCashfreePayout({ amount, upiId, merchantName, merchantMobile }) {
  try {
    const authResponse = await axios.post(`${CASHFREE_PAYOUT_URL}/payout/v1/authorize`, {
      clientId: CASHFREE_CLIENT_ID,
      clientSecret: CASHFREE_CLIENT_SECRET,
    });

    if (authResponse.status !== 200 || !authResponse.data.token) {
      throw new Error("Cashfree authorization failed");
    }

    const token = authResponse.data.token;

    const transferData = {
      beneId: `MER_${merchantMobile}`,
      amount: amount,
      transferId: `TXN_${Date.now()}_${merchantMobile}`,
      transferMode: "upi",
      upiDetails: {
        vpa: upiId, // Merchant's UPI ID
        name: merchantName,
      },
    };

    const payoutResponse = await axios.post(`${CASHFREE_PAYOUT_URL}/payout/v1/transfer`, transferData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (payoutResponse.status === 200 && payoutResponse.data.status === "SUCCESS") {
      return { success: true, transactionId: payoutResponse.data.transferId };
    } else {
      throw new Error(payoutResponse.data.message || "Unknown error from Cashfree");
    }
  } catch (error) {
    logger.error("Cashfree payout error:", error);
    return { success: false, error: error.toString() };
  }
}
