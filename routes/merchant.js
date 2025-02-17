// routes/merchant.js
const express = require("express");
const router = express.Router();
const merchantController = require("../controllers/merchantController");
const { body, param } = require('express-validator');

router.post("/create", [
    body('merchantName').trim().notEmpty().withMessage('Merchant name is required'),
    body('upiId').trim().notEmpty().withMessage('UPI ID is required'),
    body('merchantMobile').trim().notEmpty().withMessage('Mobile number is required'),
    // Add other field validations
], merchantController.addMerchant);

router.get("/:campaignId", [
    param('campaignId').isMongoId().withMessage('Invalid campaign ID')
], merchantController.getMerchants);

router.get("/get-merchant/:merchantId", [
    param('merchantId').isMongoId().withMessage('Invalid merchant ID')
], merchantController.getMerchant);

router.put("/update-merchant/:merchantId", [
    param('merchantId').isMongoId().withMessage('Invalid merchant ID'),
    // Add validation for updated fields
], merchantController.updateMerchant);

router.delete("/:merchantId", [
    param('merchantId').isMongoId().withMessage('Invalid merchant ID')
], merchantController.deleteMerchant);

module.exports = router;