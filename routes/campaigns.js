// routes/campaigns.js
const express = require("express");
const router = express.Router();
const campaignController = require("../controllers/campaignController");
const { verifyToken } = require("../middlewares/auth");
const multer = require("multer");
const { generateCampaign } = require("../controllers/campaignCreator");
const upload = multer({ dest: "uploads/" });
const { body, param } = require('express-validator');
const parseFormData = require('../middlewares/parse-form-data'); 
router.post("/create", upload.single("file"), 
parseFormData(['payoutConfig', 'merchants']),
[
  body('name').trim().notEmpty().withMessage('Campaign name is required'),
  body('company').isMongoId().withMessage('Invalid company ID'),
  body('campaignTemplate').isIn(['award', 'product', 'digital_activation']).withMessage('Invalid campaign template'),
  // Add more validation based on campaign template
], generateCampaign);

router.get("/", verifyToken, campaignController.getCampaigns);

router.get("/:campaignId", [
  param('campaignId').isMongoId().withMessage('Invalid campaign ID')
], campaignController.getCampaignById);

router.get("/:campaignId/insights", verifyToken, [
  param('campaignId').isMongoId().withMessage('Invalid campaign ID')
], campaignController.getCampaignInsights);

router.post("/:campaignId/publish", verifyToken, [
  param('campaignId').isMongoId().withMessage('Invalid campaign ID'),
  body('pin').isLength({ min: 4, max: 4 }).withMessage('PIN must be 4 digits')
], campaignController.publishCampaign);

router.get("/:campaignId/summary", verifyToken, [
  param('campaignId').isMongoId().withMessage('Invalid campaign ID')
], campaignController.getCampaignSummary);

router.get("/:campaignId/merchants/csv", verifyToken, campaignController.getCampaignMerchantsCSV);

router.get("/:campaignId/customers/csv", verifyToken, campaignController.getCampaignCustomersCSV);
router.get("/:campaignId/kpis", verifyToken, campaignController.getCampaignKPIs);
module.exports = router;