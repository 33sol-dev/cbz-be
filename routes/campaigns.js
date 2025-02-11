// routes/campaigns.js

const express = require("express");
const router = express.Router();
const campaignController = require("../controllers/campaignController");

const { verifyToken } = require("../middlewares/auth");
const multer = require("multer");
const { generateCampaign } = require("../controllers/campaignCreator");
const upload = multer({ dest: "uploads/" });

// router.post('/create', upload.single('file'), campaignController.createCampaign);
router.post("/create", upload.single("file"), generateCampaign);
router.get("/", verifyToken, campaignController.getCampaigns);
router.get("/:campaignId", campaignController.getCampaignById);
router.get(
  "/:campaignId/insights",
  verifyToken,
  campaignController.getCampaignInsights
);
router.post(
  "/:campaignId/publish",
  verifyToken,
  campaignController.publishCampaign
);
router.get(
  "/:campaignId/summary",
  verifyToken,
  campaignController.getCampaignSummary
);

module.exports = router;
