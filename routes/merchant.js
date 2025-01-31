const express = require("express")
const router = express.Router()
const merchantController = require("../controllers/merchantController")

router.post("/create", merchantController.addMerchant)
router.get("/:campaignId", merchantController.getMerchants)
router.get("/get-merchant/:merchantId", merchantController.getMerchant)
router.put("/update-merchant/:merchantId", merchantController.updateMerchant)
router.delete("/:merchantId", merchantController.deleteMerchant)

module.exports = router;