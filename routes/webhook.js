const express = require('express');
const { handleIncomingMessage } = require('../controllers/webhookController');
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const router = express.Router();

// Define the webhook route
console.log(VERIFY_TOKEN)
router.post('/', handleIncomingMessage);
const url = require('url');
router.get('/', (req, res) => {
    console.log("Request URL:", req.url);
    const parsedUrl = url.parse(req.url, true); // Manually parse query string
    console.log("Parsed Query Params:", parsedUrl.query);
    res.send(parsedUrl.query['hub.challenge'] || "No Challenge");

});

module.exports = router;
