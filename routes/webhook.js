const express = require('express');
const { handleIncomingMessage } = require('../controllers/webhookController');
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const router = express.Router();

// Define the webhook route
router.post('/', handleIncomingMessage);
router.get('/', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
  
    if (mode && token) {
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        logger.info('Webhook verified successfully');
        res.status(200).send(challenge);
      } else {
        logger.warn('Webhook verification failed');
        res.sendStatus(403);
      }
    } else {
      res.sendStatus(400);
    }

});
module.exports = router;
