const router = require("express").Router();
const campaignController = require("../controllers/campaignController");
router.post("/add-merchant/:campaignId", campaignController.addMerchant);

module.exports = router;
