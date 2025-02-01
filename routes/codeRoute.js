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