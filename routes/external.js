const express = require("express");
const router = express.Router();
const externalController = require("../controllers/externalController");


// Process Bounty Reward
router.get("/qr/processQrData/:data", externalController.processQrData);
router.post("/processBountyReward", externalController.processBountyReward);

// Register Customer
router.post("/registerCustomer", externalController.registerCustomer);

// Update Customer
router.post("/createCustomer", externalController.createCustomer);
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
