// workers/customerOnboardingWorker.js

const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const Customer = require('../models/Customer');
const Campaign = require('../models/Campaign');
const Code = require('../models/Code');
const logger = require('../utils/logger');
const connectDB = require('../db');

connectDB();

module.exports = async function (job, done) {
  try {
    logger.info(`customerOnboardingWorker started processing job ${job.id}`);
    const { companyId, campaignId, csvFilePath, userId, codes } = job.data;
    logger.info("trying to find campaing" + campaignId);
    const customers = [];
    const codeDocuments = [];

    // Get the campaign to access customFieldConfig
    const campaign = await Campaign.findById(campaignId); 

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const customFieldNames = campaign.customFieldConfig?.map((field) => field.fieldName) || [];

    let codeIndex = 0;

    // Read and parse the CSV file
    await new Promise((resolve, reject) => {
      fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (row) => {
          // Prepare customer data
          const customerData = {
            full_name: row.name,
            phone_number: row.number,
            company: companyId,
            custom_fields: {},
          };

          // Handle custom fields
          for (const fieldName of customFieldNames) {
            if (row[fieldName]) {
              customerData.custom_fields[fieldName] = row[fieldName];
            }
          }

          // Validate required fields
          if (!customerData.full_name || !customerData.phone_number) {
            logger.error(`Missing required fields in row: ${JSON.stringify(row)}`);
          } else {
            customers.push(customerData);

            // Create code document associated with the customer
            const code = codes[codeIndex++];
            codeDocuments.push({
              code: code,
              company: companyId,
              campaign: campaignId,
              assignedTo: customerData.phone_number, // Assign code to customer's phone number
            });
          }
        })
        .on('end', () => {
          resolve();
        })
        .on('error', (err) => {
          reject(err);
        });
    });

    // Check if we have any customers to insert
    if (customers.length === 0) {
      throw new Error('No valid customer data found in the CSV file.');
    }

    // Bulk insert customers
    await Customer.insertMany(customers);

    // Bulk insert codes
    await Code.insertMany(codeDocuments);

    // Update campaign status to 'Ready'
    campaign.status = 'Ready';
    await campaign.save();

    logger.info('Customer onboarding and code generation completed for campaign:', campaignId);
    done();
  } catch (err) {
    logger.error('Error in customerOnboardingWorker:', err);
    done(err);
  }
};
