const { processQrScan } = require("../controllers/codeController");

const router = require("express").Router();

router.get("/:code", processQrScan);

module.exports = router;