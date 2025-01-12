const Customer = require("../models/Customer");
const { taskCompletion } = require("./codeController");



const handleIncomingMessage = async (req, res) => {
  try {
    const message = req.body;

    if (!message || !message.from) {
      return res.status(400).json({ error: "Invalid message payload." });
    }

    const phoneNumber = message.from.split("@")[0]; // Extract the phone number
    const text = message.body; // Message content;
    const user = await Customer.findOne({ phoneNumber: phoneNumber });

    if (user) {
      // Registered user: process rewards
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
    } else {
      // Unregistered user: prompt for registration
      const registrationPrompt = `
Hi there! To get started, please register by providing:
1. Your Name
2. Your Email Address
3. Your UPI ID
For example:
John Doe, john.doe@example.com, 1234567890@upi
      `;
      await sendMessage(phoneNumber, registrationPrompt);
      return res
        .status(200)
        .json({ success: true, message: "User prompted for registration." });
    }
  } catch (error) {
    console.error("Error handling incoming message:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

const WHATSAPP_API_URL =
  "https://graph.facebook.com/v17.0/564066380115747/messages";
const TOKEN = "your_meta_access_token"; // Replace with your Meta access token

const sendMessage = async (to, message) => {
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
    throw new Error("Failed to send message.");
  }

  return response.json();
};

module.exports = {
  handleIncomingMessage,
};
