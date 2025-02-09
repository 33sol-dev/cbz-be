const { getQrByCampaign, processQrScan } = require("../controllers/codeController");
const Code = require("../models/Code");
const express = require("express");
const router = express.Router();




router.post("/get-campaign-codes", getQrByCampaign);

router.post('/process-bounty',processQrScan)


module.exports = router;