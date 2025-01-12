const Customer = require("../models/Customer");
const { taskCompletion } = require("./codeController");

const WHATSAPP_API_URL =
  "https://graph.facebook.com/v17.0/564066380115747/messages";
const TOKEN = process.env.META_ACCESS_TOKEN; // Use environment variables for security

// Handles incoming WhatsApp messages
const handleIncomingMessage = async (req, res) => {
  try {
    const message = req.body;

    // Validate incoming payload
    if (!message || !message.from || !message.body) {
      return res
        .status(400)
        .json({ error: "Invalid or incomplete message payload." });
    }

    const phoneNumber = message.from.split("@")[0]; // Extract the phone number
    const text = message.body; // Message content

    // Check if user exists in the database
    const user = await Customer.findOne({ phoneNumber: phoneNumber });

    if (user) {
      // Registered user: process rewards
      try {
        const rewardResponse = await taskCompletion({
          code: text,
          name: user.full_name,
          email: user.email,
          phoneNo: user.phone_number,
          upiId: user.upiId,
        });
        await sendMessage(phoneNumber, rewardResponse.message);
        return res
          .status(200)
          .json({ success: true, message: "Rewards processed." });
      } catch (error) {
        console.error("Error processing rewards:", error);
        return res.status(500).json({ error: "Failed to process rewards." });
      }
    } else {
      // Unregistered user: prompt for registration

      if (text.split * ",".length !== 3) {
        await sendMessage(
          phoneNumber,
          "Please provide your Name, Email Address, and UPI ID in the correct format."
        );
        return res.status(200).json({
          success: true,
          message: "Prompted for correct registration format.",
        });
      } else {
        const [name, email, upiId] = text.split(",");
        const newUser = new Customer({
          phoneNumber,
          full_name: name,
          email,
          upiId,
        });
        await newUser.save();
        await sendMessage(
          phoneNumber,
          "You have been successfully registered. Please provide the code to claim your rewards."
        );
        return res.status(200).json({
          success: true,
          message: "User registered successfully.",
        });
      }
    }
  } catch (error) {
    console.error("Error handling incoming message:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
};

// Sends a message via WhatsApp API
const sendMessage = async (to, message) => {
  try {
    const payload = {
      messaging_product: "whatsapp",
      to,
      text: { body: message },
    };

    const response = await fetch(WHATSAPP_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorResponse = await response.json();
      console.error("Failed to send message:", errorResponse);
      throw new Error("Failed to send message.");
    }

    return response.json();
  } catch (error) {
    console.error("Error in sendMessage:", error);
    throw error;
  }
};

module.exports = {
  handleIncomingMessage,
};
