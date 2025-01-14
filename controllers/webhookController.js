const Campaign = require("../models/Campaign");
const Code = require("../models/Code");
const Customer = require("../models/Customer");
const { taskCompletion, processPayment } = require("./codeController");
const axios = require("axios");
const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN; // Use environment variables for security

const messageIdMap = {}; // Map to store message IDs for tracking
const customerProcessState = {}; // Map to store customer process state

// Customer Process
// 1. Enter Trigger Text
// 2. Find if the customer already exist
// 3. If the customer exist ask the customer to enter the code
// 4. If the customer does not exist ask the customer to enter The Name
// 5. If the customer exist but does not have UPI ID ask the customer to enter the UPI ID
// 6. Ask Customer to enter the code

// Utility function for payload validation
const validatePayload = (message) => {
  if (
    !message.entry ||
    !Array.isArray(message.entry) ||
    message.entry.length === 0
  )
    return false;
  const entry = message.entry[0];
  if (
    !entry.changes ||
    !Array.isArray(entry.changes) ||
    entry.changes.length === 0
  )
    return false;
  const changes = entry.changes[0];
  if (!changes || changes.field !== "messages") return false;
  const value = changes.value;
  if (!value || !Array.isArray(value.messages) || value.messages.length === 0)
    return false;
  return true;
};

// Utility function to validate and track message IDs
const validateAndTrackMessageId = (id) => {
  if (!id || messageIdMap[id]) return false;
  messageIdMap[id] = true;
  setTimeout(() => delete messageIdMap[id], 1 * 60 * 60 * 1000); // Remove message ID after 5 minutes
  return true;
};

// Utility function to send a message
const sendMessageWithLogging = async (phoneNumber, message) => {
  try {
    console.log(`Sending message to ${phoneNumber}: ${message}`);
    await sendMessage(phoneNumber, message);
  } catch (error) {
    console.error(`Failed to send message to ${phoneNumber}:`, error);
  }
};

const handleIncomingMessage = async (req, res) => {
  try {
    const body = req.body;
    // Validate payload
    if (!validatePayload(body)) {
      return res
        .status(200)
        .send({ error: "Invalid or incomplete webhook payload." });
    }

    const messageObj = body.entry[0].changes[0].value.messages[0];
    const messageId = messageObj.id;

    // Validate and track message ID
    if (!validateAndTrackMessageId(messageId)) {
      return res
        .status(200)
        .send({ error: "Message already processed or invalid." });
    }

    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (value?.statuses) {
      // Ignore status updates and respond with success
      console.log("Ignoring status update:", value.statuses);
      return res.status(200).send({ message: "Status update ignored." });
    }

    const from = messageObj.from;
    const text = messageObj.text?.body?.trim();

    if (!from || !text) {
      return res
        .status(200)
        .send({ error: "Message content missing or invalid." });
    }

    const phoneNumber = from.split("@")[0];
    console.log(`Received message from ${phoneNumber}: ${text}`);
    await processData({ phoneNumber, text });
    res.status(200).send({ message: "Message processed successfully." });
  } catch (error) {
    console.error("Error handling incoming message:", error);
    return res.status(200).send("Internal server error.");
  }
};

const processData = async ({ phoneNumber, text }) => {
  if (customerProcessState[phoneNumber]) {
    const val = customerProcessState[phoneNumber];
    switch (val) {
      case "Enter Trigger Text":
        const campaign = await Campaign.findOne({ triggerText: text });
        if (!campaign) {
          await sendMessage(
            phoneNumber,
            "Your text is not valid. Please provide a valid code to claim your rewards."
          );
          break;
        }
        const customer = await Customer.findOne({ phone_number: phoneNumber });
        if (customer) {
          if (!customer.upiId) {
            await sendMessage(
              phoneNumber,
              "Please provide your UPI ID to claim your rewards."
            );
            customerProcessState[phoneNumber] = "Enter UPI ID";
            break;
          } else {
            await sendMessage(
              phoneNumber,
              "Please provide the code to claim your rewards."
            );
            customerProcessState[phoneNumber] = "Enter Code";
            break;
          }
        } else {
          await sendMessage(
            phoneNumber,
            "Please provide your name to claim your rewards."
          );
          customerProcessState[phoneNumber] = "Enter Name";
        }
        break;
      case "Enter Name":
        await new Customer({ phone_number: phoneNumber, full_name: text }).save();
        await sendMessage(phoneNumber, "Please provide Your UPI ID.");
        customerProcessState[phoneNumber] = "Enter UPI ID";
        break;
      case "Enter UPI ID":
        const customerObj = await Customer.findOne({
          phone_number: phoneNumber,
        });
        if (!customerObj) {
          await sendMessage(
            phoneNumber,
            "Your phone number is not valid. Please provide a valid phone number to claim your rewards."
          );
          break;
        }
        customerObj.upiId = text;
        await customerObj.save();
        await sendMessage(
          phoneNumber,
          "Please provide the code to claim your rewards."
        );
        customerProcessState[phoneNumber] = "Enter Code";
        break;
      case "Enter Code":
        const code = await Code.findOne({ code: text });
        if (!code) {
          await sendMessage(
            phoneNumber,
            "Your code is not valid. Please provide a valid code to claim your rewards."
          );
          break;
        }
        if (code.isUsed) {
          await sendMessage(
            phoneNumber,
            "This code is already claimed. Please provide a new code to claim your rewards."
          );
          break;
        }
        const claimer = await Customer.findOne({ phone_number:phoneNumber });
        code.isUsed = true;
        code.claimer = claimer._id;
        await code.save();
        await sendMessage(
          phoneNumber,
          "Your code is successfully claimed. Please provide the task completion proof."
        );
        delete customerProcessState[phoneNumber];
        break;
      default:
        await sendMessage( phoneNumber, "Invalid state. Please try again." );
        break;
    }
  } else {
    customerProcessState[phoneNumber] = "Enter Trigger Text";
    await sendMessage(
      phoneNumber,
      "Please provide the trigger text to claim your rewards."
    );
  }
};

module.exports = handleIncomingMessage;

console.log(process.env.WHATSAPP_API_URL, process.env.WHATSAPP_ACCESS_TOKEN);
// Sends a message via WhatsApp API

const sendMessage = async (
  to,
  message,
  messageType = "text",
  templateName = null,
  languageCode = "en_US"
) => {
  try {
    // Ensure environment variables are set
    if (!process.env.WHATSAPP_API_URL || !process.env.WHATSAPP_ACCESS_TOKEN) {
      throw new Error(
        "WhatsApp API URL or token is not defined in environment variables."
      );
    }

    // Construct the payload based on message type
    let payload;
    if (messageType === "text") {
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to, // WhatsApp number including country code, e.g., 16315551181
        type: "text",
        text: { body: message },
      };
    } else if (messageType === "template") {
      if (!templateName) {
        throw new Error(
          "Template name is required for sending template messages."
        );
      }
      payload = {
        messaging_product: "whatsapp",
        to, // WhatsApp number including country code, e.g., 16315551181
        type: "template",
        template: {
          name: templateName,
          language: {
            code: languageCode,
          },
        },
      };
    } else {
      throw new Error(
        "Unsupported message type. Only 'text' and 'template' are supported."
      );
    }

    // Send the request to the WhatsApp API
    const response = await fetch(process.env.WHATSAPP_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    // Handle API response
    if (!response.ok) {
      const errorResponse = await response.json();
      console.error("Failed to send message:", errorResponse);
      throw new Error(
        `Failed to send message: ${errorResponse.message || "Unknown error"}`
      );
    }

    // Parse and return the API response
    const data = await response.json();
    console.log("Message sent successfully:", data);
    return data;
  } catch (error) {
    console.error("Error in sendMessage:", error);
    throw error;
  }
};

module.exports = {
  handleIncomingMessage,
};
