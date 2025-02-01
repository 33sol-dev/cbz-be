const Code = require("../models/Code");
const express = require("express");
const router = express.Router();

router.get("/getQrByCampaign", getQrByCampaign);

getQrByCampaign = async (req, res) => {
  const { campaignId } = req.body;
  const codes = await Code.find({ campaign: campaignId });
  res.json({ codes });
};