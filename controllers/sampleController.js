const SampleCode = require("../models/SampleCode");
const axios = require("axios");
const logger = require("../utils/logger");
const { sendMessage } = require("./webhookController");


/**
 * Generate a unique sample code that is not in the database
 */
const generateUniqueSampleCode = async () => {
  let code;
  let exists = true;

  while (exists) {
    code = "BOUNTY" + Math.floor(100000 + Math.random() * 900000); // 6-digit number
    exists = await SampleCode.exists({ code });
  }

  return code;
};

/**
 * Handle sample request and send code via WhatsApp
 */
const handleSampleRoute = async (req, res) => {
  try {
    const { viewerNumber, viewerMacAddress, merchantId, campaignId } = req.body;

    // Validate request fields
    if (!viewerNumber || !viewerMacAddress || !merchantId || !campaignId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Check if the viewer already exists for this campaign
    const existingSample = await SampleCode.findOne({
      macAddress: viewerMacAddress,
      campaign: campaignId,
    });

    if (existingSample) {
      return res.status(400).json({ message: "Viewer already exists" });
    }

    // Generate a new unique sample code
    const code = await generateUniqueSampleCode();

    // Save the viewer in the SampleCode schema
    const newSampleCode = new SampleCode({
      macAddress: viewerMacAddress,
      merchant: merchantId,
      campaign: campaignId,
      code,
    });

    await newSampleCode.save();

    // Send WhatsApp message with the code
    const whatsappResponse = await sendMessage(viewerNumber, code);

    if (!whatsappResponse.success) {
      return res.status(500).json({
        message: "Failed to send WhatsApp message",
        error: whatsappResponse.error,
      });
    }

    return res.status(200).json({
      message: "Viewer added successfully",
      code,
    });
  } catch (err) {
    logger.error("Error in handleSampleRoute:", err);
    return res.status(500).json({ message: "Server error", error: err.toString() });
  }
};


module.exports = {
  handleSampleRoute,
};
