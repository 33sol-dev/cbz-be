// routes/external.js
const express = require("express");
const router = express.Router();
const externalController = require("../controllers/externalController");
const { body, param } = require('express-validator');


// Process Bounty Reward
router.get("/qr/processQrData/:data", externalController.processQrData);

router.post("/processBountyReward", [
    body('phoneNumber').notEmpty().withMessage('Phone number is required'),
    // Add validation for other fields as needed
], externalController.processBountyReward);

// Register Customer
router.post("/registerCustomer",[
    body('full_name').notEmpty().withMessage('Name is required'),
    body('phone_number').notEmpty().withMessage('Phone Number is required'),
    body('code').notEmpty().withMessage('Code is required'),
], externalController.registerCustomer);

// Update Customer
router.post("/createCustomer", externalController.createCustomer);
router.post("/updateCustomer", externalController.updateCustomer);

// Get Payout Config
router.get("/getPayoutConfig/:campaignId", [
    param('campaignId').isMongoId().withMessage('Invalid campaign ID')
], externalController.getPayoutConfig);

// Update Payout Config
router.post("/updatePayoutConfig/:campaignId", [
    param('campaignId').isMongoId().withMessage('Invalid campaign ID'),
    body('payoutConfig').isObject().withMessage('Payout config must be an object'),
    // Add more specific validation for payoutConfig structure
], externalController.updatePayoutConfig);

// Get Campaign Data
router.get("/getCampaignData/:campaignId", [
    param('campaignId').isMongoId().withMessage('Invalid campaign ID')
], externalController.getCampaignData);



module.exports = router;