// routes/payments.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { verifyToken } = require('../middlewares/auth');
const { body } = require('express-validator');

router.post('/recharge', verifyToken, [
    body('companyId').isMongoId().withMessage('Invalid company ID'),
    body('planName').notEmpty().withMessage('Plan name is required'),
], paymentController.recharge);

module.exports = router;