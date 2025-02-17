// controllers/paymentController.js
const Company = require('../models/Company');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');

exports.recharge = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { companyId, planName, whatsappNumber } = req.body;
    const userId = req.user.id;

    try {
        const company = await Company.findOne({ _id: companyId, user: userId });
        if (!company) {
            return res.status(404).json({ message: 'Company not found' });
        }

        // Define recharge options (consider moving this to a config file)
        const rechargeOptions = {
            '1K QRs': { qrCodes: 1000, price: 5500 },
            '5K QRs': { qrCodes: 5000, price: 15000 },
            'Elite Pro': { qrCodes: 6000, price: 70000, allowsCustomWhatsappNumber: true },
        };

        if (!rechargeOptions[planName]) {
            return res.status(400).json({ message: 'Invalid recharge option selected' });
        }

        const rechargeOption = rechargeOptions[planName];

        // Process payment (integration with payment gateway needed)
        // Simulate payment success for now
        // TODO: Integrate with a real payment gateway

        // Update qrCodeBalance
        company.qrCodeBalance += rechargeOption.qrCodes;

        // For Elite Pro plan, store the custom WhatsApp number
        if (rechargeOption.allowsCustomWhatsappNumber) {
            if (!whatsappNumber) {
                return res.status(400).json({ message: 'whatsappNumber is required for Elite Pro plan' });
            }
            company.whatsappNumber = whatsappNumber;
        }

        // Add to recharge history
        company.recharges.push({
            planName: planName,
            qrCodesAdded: rechargeOption.qrCodes,
            amount: rechargeOption.price,
            date: new Date(),
        });

        await company.save();
        res.json({ message: 'Recharge successful', company });
    } catch (error) {
        logger.error('Error in recharge:', error);
        res.status(500).json({ message: 'Server error', error: error.toString() });
    }
};