// controllers/companyController.js
const Company = require("../models/Company");
const User = require("../models/User");
const logger = require("../utils/logger");
const { validationResult } = require('express-validator');

exports.createCompany = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const {
        name,
        contactName,
        email,
        phoneNumber,
        description,
        website,
        gstin,
        pan,
        industry,
    } = req.body;
    const userId = req.user.id;

    try {
        const userObj = await User.findById(userId);
        if (!userObj) {
            return res.status(400).json({ message: "User Not Found" }); // Return for early exit
        }

        const company = new Company({
            user: userId,
            name,
            contactName,
            email,
            phoneNumber,
            description,
            website,
            gstin,
            pan,
            industry,
            qrCodeBalance: 3, // Start with 3 QR codes for trial
        });
        await company.save();

        userObj.company = company.id;
        await userObj.save();

        res.status(201).json({ message: "Company created successfully", companyId: company._id });
    } catch (error) {
        logger.error("Error in createCompany:", error);
        res.status(500).json({ message: "Server error", error: error.toString() });
    }
};

exports.getCompanies = async (req, res) => {
    try {
        logger.info("Fetching companies for user ID:", req.user);
        const companies = await Company.find({ user: req.user.id }).lean(); // Use lean()
        logger.info("Found companies:", companies.length);
        res.json({ companies });
    } catch (err) {
        logger.error("Error in getCompanies:", err);
        res.status(500).send("Server Error");
    }
};

exports.getCompany = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const companyId = req.params.id;
    try {
        const company = await Company.findOne({ _id: companyId, user: req.user.id }).lean(); // Use lean()
        if (!company) {
            return res.status(404).send({ message: "Company not found" });
        }
        res.send(company);
    } catch (error) {
        res.status(500).send(error);
    }
};

exports.updateCompany = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const companyId = req.params.id;
    const updates = req.body;
    try {
        const company = await Company.findOneAndUpdate(
            { _id: companyId, user: req.user.id },
            updates,
            { new: true, runValidators: true } // Important: runValidators for schema validation
        );
        if (!company) {
            return res.status(404).send({ message: "Company not found" });
        }
        res.send({ message: "Company updated successfully", company });
    } catch (error) {
        res.status(500).send(error);
    }
};