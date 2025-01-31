const express = require("express")
const router = express.Router()
const merchantController = require("../controllers/merchantController")

router.post("/create", merchantController.addMerchant)
router.get("/", merchantController.getMerchants)
router.get("/:merchantId", merchantController.getMerchant)
router.put("/:merchantId", merchantController.updateMerchant)
router.delete("/:merchantId", merchantController.deleteMerchant)

module.exports = router;