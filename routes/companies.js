// routes/companies.js
const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const { body, param } = require('express-validator');
const { verifyToken } = require('../middlewares/auth'); // Import verifyToken

router.post('/', verifyToken, [
    body('name').trim().notEmpty().withMessage('Company name is required'),
    body('email').isEmail().withMessage('Invalid email address').normalizeEmail(),
    // Add more validation rules as needed
], companyController.createCompany);

router.get('/', verifyToken, companyController.getCompanies);

router.get('/:id', verifyToken, [
    param('id').isMongoId().withMessage('Invalid company ID')
], companyController.getCompany);

router.put('/:id', verifyToken, [
    param('id').isMongoId().withMessage('Invalid company ID'),
    // Add validation for update fields as needed
], companyController.updateCompany);

module.exports = router;