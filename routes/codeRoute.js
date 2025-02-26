// routes/codeRoute.js
const { getQrByCampaign, redeemBounty} = require("../controllers/codeController");
const Code = require("../models/Code");
const express = require("express");
const router = express.Router();
const { body } = require('express-validator');

router.post("/get-campaign-codes", [
    body('campaignId').isMongoId().withMessage('Invalid campaign ID')
], getQrByCampaign);

router.post(
    "/redeem-bounty",
    [
      body("phoneNumber").notEmpty().withMessage("Phone number is required"),
      body("code").notEmpty().withMessage("Code is required"),
    ],
    redeemBounty
  );
module.exports = router;