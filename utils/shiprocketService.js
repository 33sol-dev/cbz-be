// utils/shiprocketService.js
const axios = require('axios');
const logger = require('./logger');

async function createShipment({ customer, address, customFields, company, campaign }) {
    try {
        // Prepare shipment data according to Shiprocket's API requirements
        const shipmentData = {
            // ... construct the shipment data using customer, address, customFields, company, and campaign data
            // This is a placeholder.  You'll need to adapt this to the *exact* format required by Shiprocket.
            // Refer to Shiprocket's API documentation for the required fields and structure.

            // Example (replace with actual fields):
            order_id: `ORDER-${Date.now()}`, // Generate a unique order ID
            order_date: new Date().toISOString(),
            pickup_location: company.address, // Assuming company has an address
            channel_id: "",  //  your channel ID
            customer_name: customer.full_name,
            customer_email: customer.email,
            customer_phone: customer.phone_number,
            customer_address: address, // Full address from customer
            // ... other required fields based on Shiprocket's API ...
            products: [
                {
                    name: campaign.name, // Use campaign name as product name
                    sku: campaign.id, // Use campaign ID as SKU
                    units: 1,
                    selling_price: 0, // Gifts usually have a selling price of 0
                    // ... other product details ...
                }
            ]

        };


      const response = await axios.post(
        'https://apiv2.shiprocket.in/v1/external/shipments', // Shiprocket API endpoint
        shipmentData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SHIPROCKET_TOKEN}`, // Use environment variable
          },
        }
      );

      logger.info('Shiprocket Shipment Success Response:', response.data);
      return {
        success: true,
        data: response.data, // Return the full response from Shiprocket
      };

    } catch (error) {
        if (error.response && error.response.data) {
            logger.error('Shiprocket Shipment Error Response:', error.response.data);
            return {
              success: false,
              data: error.response.data, // Return the error response from Shiprocket
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