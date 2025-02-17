// controllers/webhookController.js (Improved with better state management and error handling)

const Campaign = require("../models/Campaign");
const Code = require("../models/Code");
const Customer = require("../models/Customer");
const { initiateUPIPayout } = require("../utils/paymentService");

const messageIdMap = {}; // Track processed messages
const customerProcessState = {}; // Track customer states

// Validate incoming message payload
const validatePayload = (message) => {
  if (!message.entry || !Array.isArray(message.entry) || message.entry.length === 0) return false;
  const entry = message.entry[0];
  if (!entry.changes || !Array.isArray(entry.changes) || entry.changes.length === 0) return false;
  const changes = entry.changes[0];
  if (!changes || changes.field !== "messages") return false;
  const value = changes.value;
  if (!value || !Array.isArray(value.messages) || value.messages.length === 0) return false;
  return true;
};

// Validate and track message ID to prevent duplicate processing
const validateAndTrackMessageId = (id) => {
  if (!id || messageIdMap[id]) return false;
  messageIdMap[id] = true;
  setTimeout(() => delete messageIdMap[id], 60 * 60 * 1000); // Remove after 1 hour
  return true;
};


const handleIncomingMessage = async (req, res) => {
    try {
        const body = req.body;
        if (!validatePayload(body)) {
          return res.status(200).json({ action: "ignore", reason: "Invalid payload" });
        }

        const messageObj = body.entry[0].changes[0].value.messages[0];
        const messageId = messageObj.id;
        if (!validateAndTrackMessageId(messageId)) {
          return res.status(200).json({ action: "ignore", reason: "Duplicate message" });
        }

        const from = messageObj.from;
        const text = messageObj.text?.body?.trim();

        if (!from || !text) {
          return res.status(200).json({ action: "ignore", reason: "Missing message content" });
        }

        const phoneNumber = from.split("@")[0];
        console.log(`Received message from ${phoneNumber}: ${text}`);

        const response = await processData({ phoneNumber, text });
        res.status(200).json(response);

      } catch (error) {
        console.error("Error handling message:", error);
        res.status(200).json({ action: "error", reason: "Internal server error" });
      }
};

const processData = async ({ phoneNumber, text }) => {
  if (customerProcessState[phoneNumber]) {
    return await handleCustomerState(phoneNumber, text);
  } else {
    return await processFirstMessage(phoneNumber, text);
  }
};

const processFirstMessage = async (phoneNumber, text) => {
  const claimer = await Customer.findOne({ phone_number: phoneNumber }).lean();
  if (!claimer) {
    customerProcessState[phoneNumber] = "Enter Name";
    return { action: "request_input", message: "Please provide your name to claim your rewards." };
  } else {
    if (!claimer.upiId) {
      customerProcessState[phoneNumber] = "Enter UPI ID";
      return { action: "request_input", message: "Please provide your UPI ID to claim your rewards." };
    }
    return await verifyAndProcessCode(phoneNumber, text, claimer);
  }
};

const handleCustomerState = async (phoneNumber, text) => {
    const state = customerProcessState[phoneNumber];

    if (state === "Enter Name") {
        await Customer.create({ phone_number: phoneNumber, full_name: text });
        customerProcessState[phoneNumber] = "Enter UPI ID";
        return { action: "request_input", message: "Please provide Your UPI ID." };
    }

    if (state === "Enter UPI ID") {
        const customerObj = await Customer.findOne({ phone_number: phoneNumber });
        if (!customerObj) {
            return { action: "error", message: "Invalid phone number. Please try again." };
        }
        customerObj.upiId = text;
        await customerObj.save();
        customerProcessState[phoneNumber] = "Enter Code";
        return { action: "request_input", message: "Please provide the code to claim your rewards." };
    }

    if (state === "Enter Code") {
        const claimer = await Customer.findOne({ phone_number: phoneNumber }).lean();
        return await verifyAndProcessCode(phoneNumber, text, claimer);
    }

    return { action: "error", message: "Invalid state. Please try again." };
};



const verifyAndProcessCode = async (phoneNumber, text, claimer) => {
  const code = await Code.findOne({ code: text }).populate("campaign").lean();
  if (!code) {
    return { action: "error", message: "Invalid code. Please provide a valid code." };
  }
  if (code.isUsed) {
    return { action: "error", message: "Code already claimed. Please use a new code." };
  }

  const { campaign } = code;

//   const recipientUpi = campaign.taskType === "digital_activation" ? campaign.merchant.upiId : claimer.upiId;

//   await processPayment(campaign.rewardAmount, recipientUpi); //Simplified
//   initiateUPIPayout(recipientUpi,rewardAmount,campaign.merchant.merchantName)
  // Update code status (consider using findOneAndUpdate for atomicity)
  await Code.updateOne({ _id: code._id }, { isUsed: true, claimer: claimer._id });

  delete customerProcessState[phoneNumber];
  return { action: "request_proof", message: "Code successfully claimed. Please provide task completion proof." };
};


module.exports = { handleIncomingMessage };