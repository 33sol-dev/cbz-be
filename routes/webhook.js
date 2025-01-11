const express = require('express');
const { handleIncomingMessage } = require('../controllers/webhookController');

const router = express.Router();

// Define the webhook route
router.post('/webhook', handleIncomingMessage);
router.get('/', (req, res) => {
    res.status(200).send('Webhook is working!');
});
module.exports = router;
