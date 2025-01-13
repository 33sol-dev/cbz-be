const Campaign = require("../models/Campaign");
const Code = require("../models/Code");
const Customer = require("../models/Customer");
const { taskCompletion, processPayment } = require("./codeController");
const axios = require("axios");
const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN; // Use environment variables for security

const messageIdMap = {}; // Map to store message IDs for tracking

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

    const phoneNumber = from.split("@")[0]; // Extract phone number
    console.log(`Received message from ${phoneNumber}: ${text}`);

    // Check if user exists in the database
    const user = await Customer.findOne({ phone_number: phoneNumber });

    if (user) {
      // User exists, handle campaign or rewards
      if (text.includes("BOUNTY")) {
        const code = await Code.findOne({ code: text });
        if (!code) {
          await sendMessageWithLogging(
            phoneNumber,
            "Invalid code. Please provide a valid code to claim your rewards."
          );
          return res
            .status(200)
            .send({ success: true, message: "Prompted for valid code." });
        }
        if (code.isUsed) {
          await sendMessageWithLogging(
            phoneNumber,
            "Code already used. Please provide a valid code to claim your rewards."
          );
          return res
            .status(200)
            .send("Code already used. Please provide a valid code to claim your rewards.");
        }
        const campaign = await Campaign.findOne({ _id: code.campaign }).populate("beneficiary");
        console.log("Campaign:", campaign);
        console.log("User:", user);
        // Process reward payment
        const beneficiaryUpiId =
          campaign.taskType === "digital_activation"
            ? campaign.beneficiary.upiId
            : user.upiId;

        processPayment(campaign.totalAmount, beneficiaryUpiId);
        code.isUsed = true;
        code.usedBy = user._id;
        code.usedAt = new Date();

        await code.save();
        await sendMessageWithLogging(
          phoneNumber,
          "Payment processed successfully."
        );
        return res
          .status(200)
          .send("Payment processed successfully.");
      } else {
        // Handle other campaign triggers
        const campaign = await Campaign.findOne({ triggerText: text });
        if (!campaign) {
          await sendMessageWithLogging(
            phoneNumber,
            "Your text is not valid. Please provide a valid code to claim your rewards."
          );
          return res
            .status(200)
            .send("Your text is not valid. Please provide a valid code to claim your rewards.");
        }
        await sendMessageWithLogging(
          phoneNumber,
          "Sure! Enter your code to process the reward."
        );
        return res
          .status(200)
          .send("Sure! Enter your code to process the reward.");
      }
    } else {
      // User doesn't exist, prompt for registration
      const splitText = text.split(",");
      if (splitText.length !== 3) {
        await sendMessageWithLogging(
          phoneNumber,
          "Please provide your Name, Email Address, and UPI ID in the correct format, separated by commas."
        );
        return res.status(200).send("Prompted for correct registration format.");
      }

      const [name, email, upiId] = splitText.map((s) => s.trim());

      // Validate email and UPI ID
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const upiRegex = /^[a-zA-Z0-9.]+@[a-zA-Z]+$/;

      if (!emailRegex.test(email)) {
        await sendMessageWithLogging(
          phoneNumber,
          "Invalid email format. Please provide a valid email address."
        );
        return res
          .status(200)
          .send("Prompted for valid email format.");
      }
      if (!upiRegex.test(upiId)) {
        await sendMessageWithLogging(
          phoneNumber,
          "Invalid UPI ID format. Please provide a valid UPI ID."
        );
        return res.status(200).send("Prompted for valid UPI ID format.");
      }

      // Save the new user to the database
      const newUser = new Customer({
        phone_number: phoneNumber,
        full_name: name,
        email,
        upiId,
      });

      try {
        await newUser.save();
        await sendMessageWithLogging(
          phoneNumber,
          "You have been successfully registered. Please provide the code to claim your rewards."
        );
        return res
          .status(200)
          .send("User registered successfully.");
      } catch (error) {
        console.error("Error saving user to the database:", error);
        return res
          .status(200)
          .send("Failed to save user to the database.");
      }
    }
  } catch (error) {
    console.error("Error handling incoming message:", error);
    return res.status(200).send("Internal server error.");
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
