const express = require('express');
const router = express.Router();
const externalController = require('../controllers/externalController');

// Existing routes...

// Process Bounty Reward
router.post('/processBountyReward', externalController.processBountyReward);

// Register Customer
router.post('/registerCustomer', externalController.registerCustomer);

// Update Customer
router.post('/updateCustomer', externalController.updateCustomer);

// Get Payout Config
router.get('/getPayoutConfig/:campaignId', externalController.getPayoutConfig);

// Update Payout Config
router.post('/updatePayoutConfig/:campaignId', externalController.updatePayoutConfig);

// Get Campaign Data
router.get('/getCampaignData/:campaignId', externalController.getCampaignData);

module.exports = router;
