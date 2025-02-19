// workers/qrCodeWorker.js
const Code = require("../models/Code");
const Campaign = require("../models/Campaign");
const Company = require("../models/Company");

module.exports = async function (job, done) {
  try {
    const {
      companyId,
      campaignId,
      codes,
      campaignTemplate,
      taskUrl, // Now REQUIRED for product campaigns
    } = job.data;

    const campaign = await Campaign.findById(campaignId);
    const company = await Company.findById(companyId);

    if (!company) {
      throw new Error(`Company with ID ${companyId} not found.`);
    }
    if (!campaign) {
      throw new Error(`Campaign with ID ${campaignId} not found.`);
    }
    if (!taskUrl) { //taskURL validation
        throw new Error("Task URL is required")
    }

    // ONLY process if campaignTemplate is 'product'
    if (campaignTemplate === 'product') {
      console.log(`Processing QR Code Generation for Product Campaign: ${campaignId}`);

      const qrCodePromises = codes.map((code) => {
        const fullUrl = taskUrl + code; // Construct the full URL (taskUrl already has ?code=)
        return new Code({
          code: code,
          campaignTemplate: campaignTemplate,
          company: companyId,
          campaign: campaignId,
          url: fullUrl, // Store the full URL, ready for QR generation
        });
      });

      const qrCodes = await Promise.all(qrCodePromises);
      await Code.insertMany(qrCodes);

      campaign.status = "Ready";
      company.qrCodeBalance -= codes.length;

      await company.save();
      await campaign.save();

      done();
    } else {
      // If not a 'product' campaign, just mark as complete (or log a warning)
      console.warn(`qrCodeWorker received a non-product campaign: <span class="math-inline">\{campaignId\} \(</span>{campaignTemplate}).  Ignoring.`);
      done();
    }


  } catch (error) {
    console.error("Error processing QR code generation job:", error);
    done(new Error("Failed to process QR code generation job."));
  }
};