// routes/merchant.js
const express = require("express");
const router = express.Router();
const merchantController = require("../controllers/merchantController");
const { body, param } = require('express-validator');

router.post("/create", [
    // Optional boolean flag indicating dummy merchant creation
    body('isDummy').optional().isBoolean().withMessage('isDummy must be a boolean'),
    // Only validate required fields if not creating a dummy
    body('merchantName')
      .if((value, { req }) => !req.body.isDummy)
      .trim().notEmpty().withMessage('Merchant name is required'),
    body('upiId')
      .if((value, { req }) => !req.body.isDummy)
      .trim().notEmpty().withMessage('UPI ID is required'),
    body('merchantMobile')
      .if((value, { req }) => !req.body.isDummy)
      .trim().notEmpty().withMessage('Mobile number is required'),
    // Add other field validations as needed
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