const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { QRCodeCanvas } = require('@loskir/styled-qr-code-node');
const QRCode = require('qrcode');
const sharp = require('sharp');
const Code = require('../models/Code');
const logger = require('../utils/logger');

// Function to download the logo from URL
async function downloadLogo(logoUrl) {
  try {
    const response = await axios({
      url: logoUrl,
      responseType: 'arraybuffer',
    });
    return response.data;
  } catch (error) {
    logger.error('Failed to download logo:', error);
    throw error;
  }
}

// Function to generate unique codes
exports.generateUniqueCode = (initials) => {
  let uniqueCode;
  let isUnique = false;

  while (!isUnique) {
    uniqueCode = `${initials}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const existingCode =  Code.findOne({ code: uniqueCode });
    if (!existingCode) {
      isUnique = true;
    }
  }
  return uniqueCode;
};

exports.generateQR = async (payload, filename, qrStyle, defaultLogoPath, logoUrl) => {
  try {
    if (qrStyle === 'simple') {
      logger.info("pay;skdnckd" + payload);
      // Generate simple QR code
      await QRCode.toFile(filename, payload);
      logger.info(`Simple QR code saved to: ${filename}`);
    } else if (qrStyle === 'stylized') {
      // Download logo from URL or use default logo
      let logoBuffer;
      if (logoUrl) {
        logoBuffer = await downloadLogo(logoUrl);
      } else {
        logoBuffer = fs.readFileSync(defaultLogoPath);
      }

      // Optionally, you can resize or process the logo using sharp
      const processedLogo = await sharp(logoBuffer)
        .resize(500, 500) // Adjust size as needed
        .toBuffer();

      // Generate stylized QR code
      const qrCode = new QRCodeCanvas({
        width: 2400,
        height: 2400,
        type: "png",
        data: payload,
        image: processedLogo,
        dotsOptions: {
          color: "#000080",
          type: "dots",
        },
        cornersSquareOptions: {
          type: "extra-rounded",
          color: "#000080",
        },
        cornersDotOptions: {
          type: "dot",
          color: "#000080",
        },
        backgroundOptions: {
          color: "#ffffff",
        },
        imageOptions: {
          crossOrigin: "anonymous",
          margin: 0,
          imageSize: 0.8,
          hideBackgroundDots: true,
        },
      });

      await qrCode.toFile(filename);
      logger.info(`Stylized QR code saved to: ${filename}`);
    } else {
      throw new Error('Invalid qrStyle specified.');
    }
  } catch (error) {
    logger.error(`Failed to generate QR code at ${filename}:`, error);
    throw error;
  }
};
