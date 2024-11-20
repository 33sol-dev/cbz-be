// controllers/externalController.js

const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Company = require('../models/Company');
const Code = require('../models/Code');
const Campaign = require('../models/Campaign');
const Transaction = require('../models/Transaction');
const { initiateUPIPayout } = require('../utils/paymentService');
const { createShipment } = require('../utils/shiprocketService');
const logger = require('../utils/logger');

// Process Bounty Reward
exports.processBountyReward = async (req, res) => {
  try {
    const { phoneNumber, triggerData, code, additionalData } = req.body;
    const { qrDataText, triggerText } = triggerData || {};

    // Validate input
    if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    // Check if the customer is registered
    let customer = await Customer.findOne({ phone_number: phoneNumber });

    if (!customer) {
      return res.status(200).json({ message: 'CUSTOMER NOT REGISTERED' });
    }

    // Identify the campaign and code
    let campaign;
    let codeEntry;

    if (qrDataText) {
      // Extract the code using regex
      const codeMatch = qrDataText.split('-').pop().trim().slice(-11); 
      logger.info(codeMatch);
      if (!codeMatch) {
        return res.status(400).json({ message: 'Invalid QR data text format' });
      }
      const extractedCode = codeMatch;

      logger.info('Extracted code:', codeMatch);

      // Find the code in the database
      codeEntry = await Code.findOne({ code: codeMatch });

      if (!codeEntry) {
        return res.status(400).json({ message: 'QR CODE INVALID' });
      }

      // Check if the code is already redeemed
      if (codeEntry.isUsed) {
        return res.status(400).json({ message: 'QR CODE ALREADY USED' });
      }

      // Get the campaign
      campaign = await Campaign.findById(codeEntry.campaign);

      if (!campaign) {
        return res.status(400).json({ message: 'Campaign not found' });
      }

    } else if (triggerText) {
      // Map triggerText to a campaign
      campaign = await Campaign.findOne({ triggerText });

      if (!campaign) {
        return res.status(400).json({ message: 'Invalid trigger text' });
      }
    } else if (code) {
      // For Excel-triggered campaigns with assigned codes
      codeEntry = await Code.findOne({ code: code, assignedTo: phoneNumber, isUsed: false });

      if (!codeEntry) {
        return res.status(400).json({ message: 'Invalid or already used code' });
      }

      // Get the campaign
      campaign = await Campaign.findById(codeEntry.campaign);

      if (!campaign) {
        return res.status(400).json({ message: 'Campaign not found' });
      }
    } else {
      return res.status(400).json({ message: 'No valid trigger found' });
    }

    // Check if the campaign is active
    if (campaign.status !== 'Active') {
      logger.info(campaign);
      return res.status(400).json({ message: 'Campaign is not active' });
    }

    // Get the company
    const company = await Company.findById(campaign.company);

    if (!company) {
      return res.status(400).json({ message: 'Company not found' });
    }

    // Determine reward type
    const rewardType = campaign.reward_type;

    if (rewardType === 'cashback') {
      // Ensure customer's UPI ID is available
      if (
        !customer.payment_details ||
        !customer.payment_details.upi_ids ||
        customer.payment_details.upi_ids.length === 0
      ) {
        return res.status(400).json({ message: 'Customer UPI ID not available' });
      }

      // Get the first UPI ID
      const upiId = customer.payment_details.upi_ids[0];

      // Determine the amount to disburse based on payoutConfig
      const payoutConfig = campaign.payoutConfig || {};
      const timesUsed = await Transaction.countDocuments({
        customer: customer._id,
        campaign: campaign._id,
        status: 'SUCCESS',
      });

      const amountToDisburse =
        payoutConfig[timesUsed + 1] ||
        campaign.bounty_cashback_config?.avg_amount ||
        100; // Default to 100

      // Disburse funds via Cashfree API
      const payoutResponse = await initiateUPIPayout(
        upiId,
        amountToDisburse,
        customer.full_name || 'Beneficiary'
      );

      if (payoutResponse.success) {
        // Mark the code as used
        if (codeEntry) {
          codeEntry.isUsed = true;
          codeEntry.usedBy = customer._id;
          codeEntry.usedAt = new Date();
          await codeEntry.save();
        }

        // Log the transaction
        await Transaction.create({
          customer: customer._id,
          company: company._id,
          campaign: campaign._id,
          code: codeEntry ? codeEntry._id : null,
          amount: amountToDisburse,
          status: 'SUCCESS',
          response: payoutResponse.data,
        });

        // Update customer's last_campaign_details
        customer.last_campaign_details = {
          campaign_id: campaign._id,
          details_user_shared: additionalData || {},
          money_they_received: amountToDisburse,
        };
        await customer.save();

        res.json({ message: 'Funds disbursed successfully' });
      } else {
        // Log the failed transaction
        await Transaction.create({
          customer: customer._id,
          company: company._id,
          campaign: campaign._id,
          code: codeEntry ? codeEntry._id : null,
          amount: amountToDisburse,
          status: 'FAILED',
          response: payoutResponse.data,
        });

        res.status(500).json({
          message: 'Failed to disburse funds',
          error: payoutResponse.data.message,
        });
      }
    } else if (rewardType === 'gift') {
      // Collect necessary details
      const { address, customFields } = additionalData || {};

      // Validate required custom fields
      const requiredFields = campaign.customFieldConfig?.filter((f) => f.required) || [];
      for (const field of requiredFields) {
        if (!customFields || !customFields[field.fieldName]) {
          return res.status(400).json({ message: `Field ${field.fieldName} is required` });
        }
      }

      if (!address) {
        return res.status(400).json({ message: 'Address is required for gift rewards' });
      }

      // Save additional data to customer
      customer.address = address;
      customer.custom_fields = {
        ...customer.custom_fields,
        ...customFields,
      };
      await customer.save();

      // Create shipment via Shiprocket
      const shipmentResponse = await createShipment({
        customer,
        address,
        customFields,
        company,
        campaign,
      });

      if (shipmentResponse.success) {
        // Mark the code as used
        if (codeEntry) {
          codeEntry.isUsed = true;
          codeEntry.usedBy = customer._id;
          codeEntry.usedAt = new Date();
          await codeEntry.save();
        }

        // Log the transaction
        await Transaction.create({
          customer: customer._id,
          company: company._id,
          campaign: campaign._id,
          code: codeEntry ? codeEntry._id : null,
          amount: 0, // No cash amount
          status: 'SUCCESS',
          response: shipmentResponse.data,
        });

        // Update customer's last_campaign_details
        customer.last_campaign_details = {
          campaign_id: campaign._id,
          details_user_shared: additionalData || {},
          money_they_received: 0,
        };
        await customer.save();

        res.json({ message: 'Gift shipment initiated successfully' });
      } else {
        // Log the failed transaction
        await Transaction.create({
          customer: customer._id,
          company: company._id,
          campaign: campaign._id,
          code: codeEntry ? codeEntry._id : null,
          amount: 0,
          status: 'FAILED',
          response: shipmentResponse.data,
        });

        res.status(500).json({
          message: 'Failed to initiate gift shipment',
          error: shipmentResponse.data.message,
        });
      }
    } else {
      res.status(400).json({ message: 'Invalid reward type' });
    }
  } catch (error) {
    logger.error('Error in processBountyReward:', error.stack);
    res.status(500).json({ message: 'Server error', error: error.toString() });
  }
};

// Register Customer
exports.registerCustomer = async (req, res) => {
  try {
    const {
      full_name,
      phone_number,
      payment_details,
      company_id,
      custom_fields,
      social_ids,
      docs,
      campaign_id, // Optional field to tie registration to a campaign
    } = req.body;

    // Validate required fields
    if (!full_name || !phone_number) {
      return res.status(400).json({ message: 'full_name and phone_number are required' });
    }

    // Validate company_id if provided
    let company = null;
    if (company_id) {
      if (!mongoose.Types.ObjectId.isValid(company_id)) {
        return res.status(400).json({ message: 'Invalid company ID' });
      }

      // Find the company
      company = await Company.findById(company_id);
      if (!company) {
        return res.status(404).json({ message: 'COMPANY NOT FOUND' });
      }
    }

    // Validate campaign_id if provided
    if (campaign_id) {
      if (!mongoose.Types.ObjectId.isValid(campaign_id)) {
        return res.status(400).json({ message: 'Invalid campaign ID' });
      }

      const campaign = await Campaign.findById(campaign_id);

      if (!campaign) {
        return res.status(404).json({ message: 'Campaign not found' });
      }

      // Validate required custom fields
      const requiredFields = campaign.customFieldConfig?.filter((f) => f.required) || [];

      for (const field of requiredFields) {
        if (!custom_fields || !custom_fields[field.fieldName]) {
          return res.status(400).json({ message: `Field ${field.fieldName} is required` });
        }
      }
    }

    // Check if customer already exists
    let customer = await Customer.findOne({ phone_number });
    if (customer) {
      return res.status(400).json({ message: 'Customer already registered' });
    }

    // Create new customer
    customer = new Customer({
      full_name,
      phone_number,
      payment_details,
      company: company ? company._id : null,
      custom_fields,
      social_ids,
      docs,
    });

    await customer.save();

    res.status(201).json({ message: 'Customer registered successfully' });
  } catch (error) {
    logger.error('Error in registerCustomer:', error);
    res.status(500).json({ message: 'Server error', error: error.toString() });
  }
};

// Get Campaign Data
exports.getCampaignData = async (req, res) => {
  try {
    const { campaignId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(campaignId)) {
      return res.status(400).json({ message: 'Invalid campaign ID' });
    }

    // Get the campaign
    const campaign = await Campaign.findById(campaignId);

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // Get all transactions for the campaign
    const transactions = await Transaction.find({ campaign: campaignId })
      .populate({
        path: 'customer',
        select: 'full_name phone_number payment_details',
      })
      .populate({
        path: 'code',
        select: 'code',
      })
      .populate({
        path: 'company',
        select: 'name',
      });

    // Prepare data
    const data = transactions.map((txn) => {
      return {
        customerName: txn.customer.full_name,
        phoneNumber: txn.customer.phone_number,
        upiId: txn.customer.payment_details?.upi_ids[0],
        code: txn.code?.code || 'N/A',
        transactionDetails: {
          date: txn.createdAt,
          amount: txn.amount,
          status: txn.status,
          txnId:
            txn.response?.transfer?.transfer_id ||
            txn.response?.data?.transfer_id ||
            'N/A',
          mode: txn.response?.transfer?.transfer_mode || 'N/A',
          reason: txn.response?.message || 'N/A',
        },
      };
    });

    res.json({ campaign, data });
  } catch (error) {
    logger.error('Error in getCampaignData:', error);
    res.status(500).json({ message: 'Server error', error: error.toString() });
  }
};

// Update Payout Config
exports.updatePayoutConfig = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { payoutConfig } = req.body;

    if (!mongoose.Types.ObjectId.isValid(campaignId)) {
      return res.status(400).json({ message: 'Invalid campaign ID' });
    }

    // Get the campaign
    const campaign = await Campaign.findById(campaignId);

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // Update the payoutConfig
    campaign.payoutConfig = payoutConfig;
    await campaign.save();

    res.json({ message: 'Payout configuration updated successfully', campaign });
  } catch (error) {
    logger.error('Error in updatePayoutConfig:', error);
    res.status(500).json({ message: 'Server error', error: error.toString() });
  }
};
//Update Customer
exports.updateCustomer = async (req, res) => {
  try {
    const { phone_number } = req.body;

    if (!phone_number) {
      return res.status(400).json({ message: 'phone_number is required' });
    }

    // Find the customer
    let customer = await Customer.findOne({ phone_number });

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Update customer fields
    const updatableFields = [
      'full_name',
      'payment_details',
      'phone_number',
      'custom_fields',
      'social_ids',
      'docs',
      'address'
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        customer[field] = req.body[field];
      }
    });

    await customer.save();

    res.status(200).json({ message: 'Customer updated successfully', customer });
  } catch (error) {
    logger.error('Error in updateCustomer:', error);
    res.status(500).json({ message: 'Server error', error: error.toString() });
  }
};

//Get Payout Config
exports.getPayoutConfig = async (req, res) => {
  try {
    const { campaignId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(campaignId)) {
      return res.status(400).json({ message: 'Invalid campaign ID' });
    }

    // Get the campaign
    const campaign = await Campaign.findById(campaignId);

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    res.json({ payoutConfig: campaign.payoutConfig || {} });
  } catch (error) {
    logger.error('Error in getPayoutConfig:', error);
    res.status(500).json({ message: 'Server error', error: error.toString() });
  }
};
