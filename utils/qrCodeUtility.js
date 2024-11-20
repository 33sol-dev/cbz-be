// utils/qrCodeUtility.js

const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const AWS = require('aws-sdk');
const qrUtility = require('./qrStylishCreate');
const logger = require('./logger'); // Assuming you have a logger utility

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

exports.generateCampaignQRs = async (companyName, campaignName, codes, messageTemplate, mobileNumber, qrStyle, logoUrl) => {
    const basePath = path.join(__dirname, '../temp/tempQRs');
  fs.ensureDirSync(basePath); // Ensure the directory exists

  const csvWriter = createCsvWriter({
    path: path.join(basePath, 'campaign_qr_codes.csv'),
    header: [
      { id: 'code', title: 'CODE' },
      { id: 'url', title: 'URL' },
      { id: 'filename', title: 'FILENAME' },
    ],
  });

  const records = [];
  const qrDetails = [];

  const logoPath = path.join(__dirname, 'bounty.png'); // Adjust the path to your logo image

  for (const code of codes) {
    // Generate the final message by appending the code
    const finalMessage = messageTemplate + " - " + code;

    // Construct the WhatsApp URL
    const encodedMessage = encodeURIComponent(finalMessage);
    const qrContent = `https://wa.me/${mobileNumber}?text=${encodedMessage}`;

    const filename = path.join(basePath, `qr_${code}.png`);
    try {
        await qrUtility.generateQR(qrContent, filename, qrStyle, logoPath, logoUrl);
        records.push({ code, url: qrContent, filename });
        qrDetails.push({ code, filePath: filename, url: qrContent });
      } catch (error) {
        logger.error('Failed to generate QR code for:', code, error);
        continue; // Skip this code and continue with the next
      }
  }

  // Write CSV file
  try {
    await csvWriter.writeRecords(records);
  } catch (err) {
    logger.error('Failed to write CSV:', err);
  }

  // Zip the directory
  const zipPath = path.join(basePath, '../campaign_qrs.zip');
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', {
    zlib: { level: 9 }, // Compression level
  });

  archive.pipe(output);
  archive.directory(basePath, false);
  await archive.finalize();

  // Upload to S3
  const stream = fs.createReadStream(zipPath);
  const s3Params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: `campaigns/${companyName}/${campaignName}.zip`,
    Body: stream,
  };

  let uploadResult;
  try {
    uploadResult = await s3.upload(s3Params).promise();
    logger.info('Uploaded zip file to S3:', uploadResult.Location);
  } catch (err) {
    logger.error('Failed to upload zip file to S3:', err);
    throw err; // Re-throw the error to be handled by the calling function
  }

  // Clean up local files if desired
  // fs.removeSync(basePath); // Remove the temporary QR codes directory
  // fs.unlinkSync(zipPath);   // Remove the zip file

  logger.info(`Generated ${qrDetails.length} QR codes and saved CSV file.`);
  return { qrCodes: qrDetails, zipFilePath: uploadResult.Location };
};

