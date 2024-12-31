const Queue = require("bull");
const Code = require("../models/Code");
const Campaign = require("../models/Campaign");
const Company = require("../models/Company");
// Create a Bull queue for QR code generation
const qrCodeQueue = new Queue("qrCodeQueue", {
  redis: {
    host: "localhost",
    port: 6379,
  },
});

// Process jobs in the queue
qrCodeQueue.process("qrCodeGeneration",async (job, done) => {
  try {
    const { companyId, campaignId, codes, qrStyle, logoUrl } = job.data;
    const campaign = await Campaign.findById(campaignId);
    const company = await Company.findById(companyId);
    if (!company) {
      throw new Error(`Company with ID ${companyId} not found.`);
    }
    if (!campaign) {
      throw new Error(`Campaign with ID ${campaignId} not found.`);
    }
    console.log(`Processing QR Code Generation for Campaign: ${campaignId}`);
    console.log(`QR Style: ${qrStyle}, Logo: ${logoUrl}`);
    console.log(`Codes:`, codes);
    const qrCodes = codes.map((code) => {
      return new Code({
        code: code,
        company: companyId,
        campaign: campaignId,
        url: process.env.FRONTEND_URL + "/qrtask/"+ code,
      });
    });
    await Code.insertMany(qrCodes);
    campaign.status = "Ready";
    company.qrCodeBalance -= codes.length;
    await company.save();
    await campaign.save();
    // Add actual QR code generation logic here (e.g., using qrcode library)
    done();
  } catch (error) {
    console.error("Error processing QR code generation job:", error);
    done(new Error("Failed to process QR code generation job."));
  }
});

qrCodeQueue.on("error", (err) => {
  console.error("Queue Error:", err);
});

qrCodeQueue.on("stalled", (job) => {
  console.warn("Job Stalled:", job.id);
});

qrCodeQueue.on("completed", (job) => {
  console.log("Job Completed:", job.id);
});

qrCodeQueue.on("failed", (job, err) => {
  console.error("Job Failed:", job.id, err);
});

module.exports = qrCodeQueue;
