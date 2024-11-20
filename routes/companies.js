const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');

const plans = require('../config/plans');
const Company = require('../models/Company');

router.post('/', companyController.createCompany);
router.get('/', companyController.getCompanies);
router.get('/:id', companyController.getCompany);
router.put('/:id', companyController.updateCompany);
module.exports = router;
