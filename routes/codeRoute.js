// routes/codeRoute.js
const { getQrByCampaign, processQrScan,getQRCode } = require("../controllers/codeController");
const Code = require("../models/Code");
const express = require("express");
const router = express.Router();
const { body } = require('express-validator');

router.post("/get-campaign-codes", [
    body('campaignId').isMongoId().withMessage('Invalid campaign ID')
], getQrByCampaign);

router.post('/process-bounty', [
    body('number').notEmpty().withMessage('Phone number is required'),
    body('text').notEmpty().withMessage('Text is required'),
], processQrScan);
router.get("/:codeId/qr", getQRCode);
module.exports = router;