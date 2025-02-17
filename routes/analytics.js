// routes/analytics.js
const express = require("express");
const Campaign = require("../models/Campaign");
const Code = require("../models/Code");
const router = express.Router();
const { body } = require('express-validator');

router.post("/total-campaigns", [
    body('companyid').isMongoId().withMessage('Invalid company ID')
], async (req, res) => {
    const { companyid } = req.body;
    const campaigns = await Campaign.find({ company: companyid }).countDocuments();
    res.json({ campaigns });
});

router.post("/rewards-issued", [
    body('companyid').isMongoId().withMessage('Invalid company ID')
], async (req, res) => {
    try {
        const { companyid } = req.body;
        const codesData = await Code.aggregate([
            { $match: { company: companyid, isUsed: true } },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$usedAt" } },
                        year: { $year: "$usedAt" },
                    },
                    total: { $sum: 1 },
                },
            },
            {
                $project: {
                    date: "$_id.date",
                    year: "$_id.year",
                    total: 1,
                    _id: 0,
                },
            },
            { $sort: { date: 1 } },
        ]);
        res.status(200).json({
            success: true,
            data: codesData,
            total: codesData.length,
        });
    } catch (error) {
        console.error("Error fetching rewards issued data:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});

router.post("/user-onboarded", [
    body('companyid').isMongoId().withMessage('Invalid company ID')
], async (req, res) => {
    try {
        const { companyid } = req.body;
        const codesData = await Code.aggregate([
            { $match: { company: companyid, isUsed: true } },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$usedAt" } },
                        year: { $year: "$usedAt" },
                    },
                    uniqueUsers: { $addToSet: "$usedBy" },
                },
            },
            {
                $project: {
                    date: "$_id.date",
                    year: "$_id.year",
                    uniqueUserCount: { $size: "$uniqueUsers" },
                    _id: 0,
                },
            },
            { $sort: { date: 1 } },
        ]);
        res.status(200).json({
            success: true,
            data: codesData,
            total: codesData.length,
        });
    } catch (error) {
        console.error("Error fetching user onboarding data:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});

module.exports = router;