// routes/webhook.js (This file is fine, but ensure it's used correctly)
const express = require('express');
const { handleIncomingMessage } = require('../controllers/webhookController');
const constants = require("../config/constants")
const router = express.Router();

// Define the webhook route
console.log(constants.verifyToken)
router.post('/', handleIncomingMessage);

const url = require('url');
router.get('/', (req, res) => {
    console.log("Request URL:", req.url);
    const parsedUrl = url.parse(req.url, true); // Manually parse query string
    console.log("Parsed Query Params:", parsedUrl.query);
    const mode = parsedUrl.query["hub.mode"];
    const token = parsedUrl.query["hub.verify_token"];
    const challenge = parsedUrl.query["hub.challenge"];
    if (mode && token === constants.verifyToken) {
      logger.info("Webhook verified successfully.");
      res.status(200).send(challenge);
    } else {
      logger.warn("Webhook verification failed.");
      res.status(403).send("Verification failed.");
    }
});

module.exports = router;