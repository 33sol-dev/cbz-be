// routes/payments.js

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { verifyToken } = require('../middlewares/auth');

router.post('/recharge', verifyToken, paymentController.recharge);

module.exports = router;
