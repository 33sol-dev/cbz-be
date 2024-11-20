// workers/qrCodeWorker.js

const { generateCampaignQRs } = require('../utils/qrCodeUtility');
const Code = require('../models/Code');
const Company = require('../models/Company');
const Campaign = require('../models/Campaign');
const logger = require('../utils/logger');

module.exports = async function(job, done) {
  try {
    const {
      companyId,
      campaignId,
      codes,
      triggerText,
      mobileNumber,
      qrStyle,
      logoUrl, // New
    } = job.data;

    const userCompany = await Company.findById(companyId);
    const campaign = await Campaign.findById(campaignId);

    const companyName = userCompany.name;
    const campaignName = campaign.name;

    // Generate QR codes asynchronously
    const qrData = await generateCampaignQRs(
      companyName,
      campaignName,
      codes,
      triggerText,
      mobileNumber,
      qrStyle,
      logoUrl // Pass logoUrl
    );

    // Prepare code documents
    const codeDocuments = qrData.qrCodes.map((codeObj) => ({
      code: codeObj.code,
      company: userCompany._id,
      campaign: campaign._id,
      filePath: codeObj.filePath,
      url: codeObj.url,
    }));

    // Insert codes into the database
    await Code.insertMany(codeDocuments);

    // Update campaign with the zip file URL
    campaign.zipUrl = qrData.zipFilePath;
    campaign.status = 'Ready'; // Indicate that QR codes are ready
    await campaign.save();

    done();
  } catch (err) {
    logger.error('Failed to generate QR codes:', err);
    done(err);
  }
};