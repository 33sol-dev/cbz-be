const Code = require("../models/Code");
const express = require("express");
const router = express.Router();


const getQrByCampaign = async (req, res) => {
  const { campaignId } = req.body;
  const codes = await Code.find({ campaign: campaignId });
  res.json({ codes });
};

router.get("/getQrByCampaign", getQrByCampaign);


module.exports = router;