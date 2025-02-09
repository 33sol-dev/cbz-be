const express = require("express");
const router = express.Router();
const externalController = require("../controllers/externalController");
const { handleSampleRoute } = require("../controllers/sampleController");
const { processTask } = require("../controllers/taskController");
const mongoose = require("mongoose");
const Campaign = require("../models/Campaign");
// Existing routes...

const handleTask = async (req, res) => {
  const {
    campaignId,
  } = req.body;
  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    return res.json({ message: "Invalid Campaign" });
  }
  if(campaign.campaignTemplate == "award"){
    console.log("Processing Task");
    await processTask(req, res);
  }else if(campaign.campaignTemplate == "digital_activation"){
    console.log("Processing Sample");
    await handleSampleRoute(req, res);
  }
}

// Process Bounty Reward
router.get("/qr/processQrData/:data", externalController.processQrData);
router.post("/processBountyReward", externalController.processBountyReward);
router.post("/process-task", handleTask);

// Register Customer
router.post("/registerCustomer", externalController.registerCustomer);

// Update Customer
router.post("/updateCustomer", externalController.updateCustomer);

// Get Payout Config
router.get("/getPayoutConfig/:campaignId", externalController.getPayoutConfig);

// Update Payout Config
router.post(
  "/updatePayoutConfig/:campaignId",
  externalController.updatePayoutConfig
);

// Get Campaign Data
router.get("/getCampaignData/:campaignId", externalController.getCampaignData);

module.exports = router;
