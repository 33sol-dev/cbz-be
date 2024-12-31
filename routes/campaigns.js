// routes/campaigns.js

const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');
const { verifyToken } = require('../middlewares/auth');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); 

// router.post('/create', upload.single('file'), campaignController.createCampaign);
router.post('/create', verifyToken, upload.single('file'), campaignController.createCampaign);
router.get('/', verifyToken, campaignController.getCampaigns);
router.get('/:campaignId', verifyToken, campaignController.getCampaignById);
router.get('/:campaignId/insights', verifyToken, campaignController.getCampaignInsights);

router.post('/:campaignId/publish', verifyToken, campaignController.publishCampaign);


/**
 * @swagger
 * /api/campaigns/{campaignId}/payoutConfig:
 *   put:
 *     summary: Update payout configuration for a campaign
 *     tags:
 *       - Campaigns

 *     parameters:
 *       - in: path
 *         name: campaignId
 *         schema:
 *           type: string
 *         required: true
 *         description: The campaign ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - payoutConfig
 *             properties:
 *               payoutConfig:
 *                 type: object
 *                 description: The payout configuration settings
 *     responses:
 *       200:
 *         description: Payout configuration updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Payout configuration updated successfully"
 *                 campaign:
 *                   $ref: '#/components/schemas/Campaign'
 *       404:
 *         description: Campaign not found or access denied
 *       500:
 *         description: Server error
 */
router.put('/:campaignId/payoutConfig', verifyToken, campaignController.updatePayoutConfig);

/**
 * @swagger
 * /api/campaigns/{campaignId}/summary:
 *   get:
 *     summary: Get campaign summary
 *     tags:
 *       - Campaigns

 *     parameters:
 *       - in: path
 *         name: campaignId
 *         schema:
 *           type: string
 *         required: true
 *         description: The campaign ID
 *     responses:
 *       200:
 *         description: Campaign summary retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summary:
 *                   type: string
 *                   example: "Your campaign \"Festive Campaign\" reached 100 users and disbursed a total of Rs.5000 in cashback. The average cashback per user was Rs.50.00. Consider increasing engagement by offering higher rewards to first-time users."
 *       404:
 *         description: Campaign not found or access denied
 *       500:
 *         description: Server error
 */
router.get('/:campaignId/summary', verifyToken, campaignController.getCampaignSummary);

module.exports = router;
