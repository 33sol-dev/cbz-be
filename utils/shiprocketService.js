// utils/shiprocketService.js

const axios = require('axios');
const logger = require('./logger');

async function createShipment({ customer, address, customFields, company, campaign }) {
  try {
    // Prepare shipment data according to Shiprocket's API requirements
    const shipmentData = {
      // ... construct the shipment data
    };

    const response = await axios.post(
      'https://apiv2.shiprocket.in/v1/external/shipments', // Shiprocket API endpoint
      shipmentData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SHIPROCKET_TOKEN}`,
        },
      }
    );

    logger.info('Shiprocket Shipment Success Response:', response.data);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    if (error.response && error.response.data) {
      logger.error('Shiprocket Shipment Error Response:', error.response.data);

      return {
        success: false,
        data: error.response.data,
      };
    } else {
      logger.error('Shiprocket Shipment Unknown Error:', error.message);

      return {
        success: false,
        data: {
          message: 'Unknown server error occurred during shipment',
        },
      };
    }
  }
}

module.exports = { createShipment };
