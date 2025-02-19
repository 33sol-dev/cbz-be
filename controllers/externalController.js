// controllers/externalController.js
const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const Company = require("../models/Company");
const Code = require("../models/Code");
const Campaign = require("../models/Campaign");
const Transaction = require("../models/Transaction");
const { initiateUPIPayout } = require("../utils/paymentService");
const { createShipment } = require("../utils/shiprocketService");
const logger = require("../utils/logger");
const { validationResult } = require('express-validator');

// Process Bounty Reward
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

exports.processQrData = async (req, res) => {
    const url = req.originalUrl;
    const codeData = url.split("/").pop();
    res.send("QR Data processed successfully , Thank you for your time" + codeData);
};

// --- Helper Functions (Refactored for Reusability) ---

const findCustomerByPhoneNumber = async (phoneNumber) => {
    if (!phoneNumber) throw new Error("Phone number is required");
    const customer = await Customer.findOne({ phone_number: phoneNumber }).lean();
    if (!customer) throw new Error("CUSTOMER NOT REGISTERED");
    return customer;
};

const findCodeEntry = async (code) => {
    console.log(code);
    if (!code) throw new Error("Invalid code");
    const codeEntry = await Code.findOne({ code }).lean(); //Use Lean
    if (!codeEntry) throw new Error("Invalid or already used code");
    if (codeEntry.isUsed) throw new Error("Code already used");
    return codeEntry;
};

const findCampaign = async (idOrTriggerText) => {
  const campaign = isValidObjectId(idOrTriggerText)
    ? await Campaign.findById(idOrTriggerText).lean() // Use lean() and check ID validity
    : await Campaign.findOne({ triggerText: idOrTriggerText }).lean(); // Use lean()
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "Active") throw new Error("Campaign is not active");
  return campaign;
};

const findCompany = async (companyId) => {
    const company = await Company.findById(companyId).lean(); // Use lean()
    if (!company) throw new Error("Company not found");
    return company;
};

const disburseCashbackReward = async (customer, campaign, company, codeEntry, additionalData) => {
    if (!customer.payment_details?.upi_ids?.length) {
        throw new Error("Customer UPI ID not available");
    }

    const upiId = customer.payment_details.upi_ids[0];

    // --- Configurable Payout Logic ---
    const timesUsed = await Transaction.countDocuments({
        customer: customer._id,
        campaign: campaign._id,
        status: "SUCCESS",
    });

    const payoutRange = campaign.payoutConfig && campaign.payoutConfig.get(String(timesUsed + 1));
    let amountToDisburse;

    if (payoutRange) {
        // Use configured min, max, and avg
        amountToDisburse = Math.min(
            payoutRange.max,
            Math.max(payoutRange.min, payoutRange.avg) // Example logic, adjust as needed
        );
    } else {
        // Fallback to default or campaign rewardAmount if no config
        amountToDisburse = campaign.bounty_cashback_config?.avg_amount || campaign.rewardAmount || 1;
    }

    const payoutResponse = await initiateUPIPayout(upiId, amountToDisburse, customer.full_name || "Beneficiary");
    if (!payoutResponse.success) {
        throw new Error(payoutResponse.data.message || "Failed to disburse funds");
    }

     // Update code only if it exists.
     if (codeEntry) {
        await Code.updateOne({ _id: codeEntry._id }, {
            isUsed: true,
            usedBy: customer._id,
            usedAt: new Date()
        });
    }

    await Transaction.create({
        customer: customer._id,
        company: company._id,
        campaign: campaign._id,
        code: codeEntry?._id || null, // Handle potential null codeEntry
        amount: amountToDisburse,
        status: "SUCCESS",
        response: payoutResponse.data, // Store entire response for debugging
    });

      // Update customer's last campaign details
    customer.last_campaign_details = {
        campaign_id: campaign._id,
        details_user_shared: additionalData || {}, // Store any additional data
        money_they_received: amountToDisburse,
    };

    await Customer.updateOne({_id: customer._id},customer) //Use update to save
};



const initiateGiftShipment = async (customer, campaign, company, codeEntry, additionalData) => {
    const { address, customFields } = additionalData || {};
    const requiredFields = campaign.customFieldConfig?.filter((f) => f.required) || [];

    for (const field of requiredFields) {
        if (!customFields?.[field.fieldName]) {
            throw new Error(`Field ${field.fieldName} is required`);
        }
    }

    if (!address) throw new Error("Address is required for gift rewards");

    // Update customer data (consider merging existing custom fields)
    customer.address = address
    await Customer.updateOne({_id: customer._id},{
        address: address,
        $set: {  // Use $set for nested updates
            "custom_fields": { ...customer.custom_fields, ...customFields } //safe update
        }
    })

    const shipmentResponse = await createShipment({ customer, address, customFields, company, campaign });
    if (!shipmentResponse.success) {
        throw new Error(shipmentResponse.data.message || "Failed to initiate gift shipment");
    }

    // Update code only if it exists.
    if (codeEntry) {
        await Code.updateOne({ _id: codeEntry._id }, {
            isUsed: true,
            usedBy: customer._id,
            usedAt: new Date()
        });
    }

    await Transaction.create({
        customer: customer._id,
        company: company._id,
        campaign: campaign._id,
        code: codeEntry?._id || null, // Handle potential null codeEntry
        amount: 0, // Gift, so amount is 0
        status: "SUCCESS",
        response: shipmentResponse.data, // Store entire response
    });

    customer.last_campaign_details = {
        campaign_id: campaign._id,
        details_user_shared: additionalData || {}, // Store any additional data
        money_they_received: 0, //Gift
    };

    await Customer.updateOne({_id: customer._id},customer)
};



// --- Main Controller Function ---
exports.processBountyReward = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { phoneNumber, triggerData, code, additionalData } = req.body;
        const { qrDataText, triggerText } = triggerData || {};


        const customer = await findCustomerByPhoneNumber(phoneNumber);
        let campaign, codeEntry;

        if (qrDataText) {
            // Extract code from QR data (adjust logic as needed)
            const codeMatch = qrDataText.split("-").pop().trim().slice(-11);
            console.log(codeMatch);
            codeEntry = await findCodeEntry(codeMatch);
            campaign = await findCampaign(codeEntry.campaign);
        } else if (triggerText) {
            campaign = await findCampaign(triggerText);
        } else if (code) {
            codeEntry = await findCodeEntry(code);
            campaign = await findCampaign(codeEntry.campaign);
        } else {
            return res.status(400).json({ message: "No valid trigger found" });
        }
        const company = await findCompany(campaign.company);
        if (campaign.reward_type === "cashback") {
          await disburseCashbackReward(customer, campaign, company, codeEntry, additionalData);
          return res.json({ message: "Funds disbursed successfully" });
      } else if (campaign.reward_type === "gift") {
          await initiateGiftShipment(customer, campaign, company, codeEntry, additionalData);
          return res.json({ message: "Gift shipment initiated successfully" });
      } else {
          return res.status(400).json({ message: "Invalid reward type" });
      }
    } catch (error) {
        logger.error("Error in processBountyReward:", error.stack); // Log the full stack trace
        return res.status(500).json({ message: "Server error", error: error.message }); // Return a user-friendly message
    }
};

exports.createCustomer = async (req, res) => {

    try {
      const { full_name, phone_number, upiId } = req.body;
      if (!full_name || !phone_number || !upiId) {
        throw new Error("Missing Required Fields");
      }

      const customer = await Customer.create({
        ...req.body,
      });
      await customer.save();

      res.json({
        message:"Customer Created Successfully"
      })
    } catch (err) {
      res.json({
        message: "failed to create customer",
      });
    }
  };

// Register Customer
exports.registerCustomer = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const {
            full_name,
            upiId,
            phone_number,
            code,
            custom_fields,
            social_ids,
            docs,
        } = req.body;
        console.log(req.body);

        // Validate required fields (already done by express-validator)

        // Check if code is provided and valid
        if (!code) {
            return res.status(400).json({ message: "Code is required." });
        }

        const codeEntry = await Code.findOne({ code }).populate("campaign");
        if (!codeEntry) {
            return res.status(400).json({ message: "Invalid code." });
        }
        if (codeEntry.isUsed) {
            return res.status(400).json({ message: "This code has already been used." });
        }

        const campaign = codeEntry.campaign;
        if (!campaign) {
            return res.status(400).json({ message: "Invalid campaign associated with the code." });
        }
        console.log(campaign)

        // Check if customer already exists (for the same company)
        let customer = await Customer.findOne({ phone_number, company: campaign.company });
        if (customer) {
            return res.status(400).json({ message: "Customer with this phone number is already registered." });
        }


        // Create new customer
        customer = new Customer({
            full_name,
            phone_number,
            payment_details: upiId,
            company: campaign.company,
            custom_fields,
            social_ids,
            docs,
        });

        await customer.save();


        // Mark the code as used
        codeEntry.isUsed = true;
        codeEntry.usedBy = customer._id;
        codeEntry.usedAt = new Date();
        await codeEntry.save();


        res.status(201).json({ message: "Customer registered successfully." });
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: "Server error", error: error.toString() });
    }
};

// Get Campaign Data
exports.getCampaignData = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { campaignId } = req.params;

        // Get the campaign
        const campaign = await Campaign.findById(campaignId).lean();
        if (!campaign) {
            return res.status(404).json({ message: "Campaign not found" });
        }

        // Get all transactions for the campaign
        const transactions = await Transaction.find({ campaign: campaignId })
            .populate({
                path: "customer",
                select: "full_name phone_number payment_details",
            })
            .populate({
                path: "code",
                select: "code",
            })
            .populate({
                path: "company",
                select: "name",
            })
            .lean();

        // Prepare data
        const data = transactions.map((txn) => {
            return {
                customerName: txn.customer.full_name,
                phoneNumber: txn.customer.phone_number,
                upiId: txn.customer.payment_details?.upi_ids[0],
                code: txn.code?.code || "N/A", // Handle cases where code might be null
                transactionDetails: {
                    date: txn.createdAt,
                    amount: txn.amount,
                    status: txn.status,
                    txnId: txn.response?.transfer?.transfer_id || txn.response?.data?.transfer_id || "N/A",
                    mode: txn.response?.transfer?.transfer_mode || "N/A",
                    reason: txn.response?.message || "N/A", // More robust null handling
                },
            };
        });

        res.json({ campaign, data });
    } catch (error) {
        logger.error("Error in getCampaignData:", error);
        res.status(500).json({ message: "Server error", error: error.toString() });
    }
};

// controllers/externalController.js (continued)

// Update Payout Config
exports.updatePayoutConfig = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
  }

  try {
      const { campaignId } = req.params;
      const { payoutConfig } = req.body;

      // Get the campaign
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
          return res.status(404).json({ message: "Campaign not found" });
      }

      // Basic validation of payoutConfig (Ensure it's an object)
      if (typeof payoutConfig !== 'object' || payoutConfig === null) {
          return res.status(400).json({ message: 'payoutConfig must be an object' });
      }

      // Convert the payoutConfig object to a Map
      const payoutConfigMap = new Map(Object.entries(payoutConfig));

      // Validate the structure of payoutConfig (optional, but recommended)
      for (const [key, value] of payoutConfigMap) {
          if (typeof value !== 'object' || value === null ||
              typeof value.min !== 'number' || typeof value.max !== 'number' || typeof value.avg !== 'number') {
              return res.status(400).json({ message: 'Invalid payoutConfig structure' });
          }
          // Ensure min <= avg <= max
          if (value.min > value.avg || value.avg > value.max) {
              return res.status(400).json({ message: 'Invalid payoutConfig ranges (min <= avg <= max)' });
          }
      }


      // Update the payoutConfig (using the Map)
      campaign.payoutConfig = payoutConfigMap;
      await campaign.save();

      res.json({ message: "Payout configuration updated successfully", campaign });
  } catch (error) {
      logger.error("Error in updatePayoutConfig:", error);
      res.status(500).json({ message: "Server error", error: error.toString() });
  }
};

//Update Customer
exports.updateCustomer = async (req, res) => {

  try {
    const { phone_number } = req.body;

    if (!phone_number) {
      return res.status(400).json({ message: "phone_number is required" });
    }

    // Find the customer
    let customer = await Customer.findOne({ phone_number });

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // Update customer fields
    const updatableFields = [
      "full_name",
      "payment_details",
      "phone_number",
      "custom_fields",
      "social_ids",
      "docs",
      "address"
    ];
    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        customer[field] = req.body[field];
      }
    });

    await customer.save();
    res.status(200).json({ message: "Customer updated successfully", customer });
  } catch (error) {
    logger.error("Error in updateCustomer:", error);
    res.status(500).json({ message: "Server error", error: error.toString() });
  }
};

//Get Payout Config
// controllers/externalController.js
exports.getPayoutConfig = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
  
    try {
        const { campaignId } = req.params;
  
        // Get the campaign
        const campaign = await Campaign.findById(campaignId).lean(); // Use lean()
        if (!campaign) {
            return res.status(404).json({ message: "Campaign not found" });
        }
        console.log("helllo"+campaign);
        // Access payoutConfig within rewardConfig
        res.json({ payoutConfig: campaign.rewardConfig?.payoutConfig || {} }); // Return empty object if null or undefined
    } catch (error) {
        logger.error("Error in getPayoutConfig:", error);
        res.status(500).json({ message: "Server error", error: error.toString() });
    }
  };