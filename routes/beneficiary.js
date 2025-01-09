const router = require("express").Router();
const campaignController = require("../controllers/campaignController");
router.post("/add-beneficiary/:campaignId", campaignController.addBeneficiary);

module.exports = router;
