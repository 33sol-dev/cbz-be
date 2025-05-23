// controllers/sampleController.js (This file is relatively unchanged, but reviewed)
const SampleCode = require("../models/SampleCode");
const { generateUniqueCode } = require("../utils/generateUniqueCode");
const logger = require("../utils/logger");
const { sendMessage } = require("./webhookController");
const MESSAGE_TEMPLATE =
  "Hey Thank you for your interest in our product. Here is your unique sample code, use it to get your free sample: ";

/**
 * Generate a unique sample code that is not in the database
 */

/**
 * Handle sample request and send code via WhatsApp
 */
const handleSampleRoute = async (req, res) => {
  try {
    const { viewerNumber, macAddress, merchantId, campaignId } = req.body;

    // Validate request fields
    if (!viewerNumber || !macAddress || !merchantId || !campaignId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Check if the viewer already exists for this campaign
    const existingSample = await SampleCode.findOne({
      macAddress: macAddress,
      campaign: campaignId,
    });
    if (existingSample) {
      return res.status(400).json({ message: "Viewer already exists" });
    }

    // Generate a new unique sample code
    const code = await generateUniqueCode();

    // Save the viewer in the SampleCode schema
    const newSampleCode = new SampleCode({
      macAddress: macAddress,
      merchant: merchantId,
      campaign: campaignId,
      samplerMobile: viewerNumber,
      code,
    });
    await newSampleCode.save();

    // Send WhatsApp message with the code
    await sendMessage(
      viewerNumber,
       MESSAGE_TEMPLATE + code // Use a template
    );

    // controllers/sampleController.js (continued)
    return res.status(200).json({
      message: "Viewer added successfully",
      code,
    });
  } catch (err) {
    logger.error("Error in handleSampleRoute:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.toString() });
  }
};

module.exports = {
  handleSampleRoute,
};