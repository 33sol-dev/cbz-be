const {
  processQrScan,
  taskCompletion,
} = require("../controllers/codeController");

const router = require("express").Router();

router.get("/:code", processQrScan);
router.post("/complete-task", taskCompletion);

module.exports = router;
