const express = require("express");
const Campaign = require("../models/Campaign");
const Code = require("../models/Code");
const router = express.Router();


router.post("/total-campaigns",async (req,res)=>{
    const {companyid} = req.body;
    const campaigns = await Campaign.find({company:companyid}).countDocuments();
    res.json({campaigns});
})

router.post("/rewards-issued", async (req, res) => {
    try {
        const { companyid } = req.body;
        const codesData = await Code.aggregate([
            { $match: { company: companyid, isUsed: true } }, // Filter codes for the company and used ones
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$usedAt" } }, // Group by date
                        year: { $year: "$usedAt" }, // Add year for separation
                    },
                    total: { $sum: 1 }, // Count codes
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
            { $sort: { date: 1 } }, // Sort by date for line chart plotting
        ]);

        // Step 3: Respond with data structured for the line chart
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

router.post("/user-onboarded", async (req, res) => {
    try {
        const { companyid } = req.body;
        const codesData = await Code.aggregate([
            { $match: { company: companyid, isUsed: true } }, // Filter codes for the company and used ones
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$usedAt" } }, // Group by date
                        year: { $year: "$usedAt" }, // Add year for separation
                    },
                    uniqueUsers: { $addToSet: "$usedBy" }, // Collect unique user IDs
                },
            },
            {
                $project: {
                    date: "$_id.date",
                    year: "$_id.year",
                    uniqueUserCount: { $size: "$uniqueUsers" }, // Count unique users
                    _id: 0,
                },
            },
            { $sort: { date: 1 } }, // Sort by date for line chart plotting
        ]);

        // Step 3: Respond with data structured for the line chart
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