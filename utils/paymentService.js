// utils/paymentService.js
const axios = require('axios');
const logger = require('./logger');

// Custom error class for invalid UPI IDs
class InvalidUPIError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidUPIError';
  }
}

// Function to initiate UPI payout via Cashfree (Refactored)
async function initiateUPIPayout(upiId, amount, merchantName) {
  try {
      const response = await axios.post('https://api.cashfree.com/payout/transfers', {
          merchant_details: {
              merchant_name: merchantName,
              merchant_instrument_details: {
                  vpa: upiId  // UPI ID of the merchant
              }
          },
          transfer_mode: 'upi',
          transfer_id: "txn_" + Date.now(), // Generate a unique transaction ID
          transfer_amount: amount   // Configurable amount
      }, {
          headers: {
              'Content-Type': 'application/json',
              'x-api-version': '2024-01-01',
              'x-client-id': process.env.CASHFREE_CLIENT_ID, // Use environment variables for security
              'x-client-secret': process.env.CASHFREE_CLIENT_SECRET
          }
      });

      return response.data;  // Return the response data

  } catch (error) {
      console.error('Error during payout:', error.response ? error.response.data : error.message);
      // Check if the error is due to an invalid UPI ID
      if (error.response && error.response.data) {
          const errorReason = error.response.data.reason || error.response.data.message || '';
          if (errorReason.toLowerCase().includes('invalid upi') || errorReason.toLowerCase().includes('vpa not valid')) {
              throw new InvalidUPIError('Invalid UPI ID provided.');
          }
      }
      // For all other errors, throw a generic payout failure error
      throw new Error('Payout failed due to an unexpected error.'+error);
  }
}


module.exports = { initiateUPIPayout, InvalidUPIError }; // Export the error class as well