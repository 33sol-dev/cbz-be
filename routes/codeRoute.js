<<<<<<< HEAD
const Code = require("../models/Code");
const express = require("express");
const router = express.Router();

router.get("/getQrByCampaign", getQrByCampaign);

getQrByCampaign = async (req, res) => {
  const { campaignId } = req.body;
  const codes = await Code.find({ campaign: campaignId });
  res.json({ codes });
};
=======
const {
    processQrScan,
    taskCompletion,
    getQrByCampaign,
  } = require("../controllers/codeController");
  
  const router = require("express").Router();
  
  router.get("/:code", processQrScan);
  router.post("/complete-task", taskCompletion);
  router.post("/get-campaign-codes", getQrByCampaign);
  
  module.exports = router;
>>>>>>> e52bc63884880e572a20c2753c4cde48e234cb05
