const express = require("express");
const router = express.Router();
const externalController = require("../controllers/externalController");
const { handleSampleRoute } = require("../controllers/sampleController");
const { processTask } = require("../controllers/taskController");
const mongoose = require("mongoose")
// Existing routes...

// Process Bounty Reward
router.get("/qr/processQrData/:data", externalController.processQrData);
router.post("/processBountyReward", externalController.processBountyReward);
router.post("/process-task-reward", processTask);
router.post("/sample-route", handleSampleRoute);

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
