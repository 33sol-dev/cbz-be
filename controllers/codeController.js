const Beneficiary = require("../models/Beneficiary");
const Code = require("../models/Code");
const Customer = require("../models/Customer");

// You can add Different Task Functions as per the Added Task types in the Campaign
const taskFunctionsMap = {
  award: (code) => {
    // Redirect To URL to collect UPI Details
    console.log("Redirecting to Award Page");
    return {
      redirectUrl: "http://localhost:3000/award",
      action: null,
    };
  },
  digital_activation: async (code) => {
    // Sending Money To beneficiary
    const beneficiary = await Beneficiary.findOne({ campaign: campaign._id });
    console.log("Sending Money to Beneficiary", beneficiary.upiId);
    return {
      redirectUrl: null,
      action: null,
    };
  },
  social_media: (code) => {
    // redirect to social media sharing
    console.log("Sharing on social media");
    return {
      redirectUrl: `http://localhost:3000/social/${code.code}`,
      action: null,
    };
  },
  location_sharing: (code) => {
    // redirect to location sharing
    console.log("Sharing location");
    return {
      redirectUrl: `http://localhost:3000/location/${code.code}`,
      action: null,
    };
  },
};
// Frontend -> QR Code Scan -> Backend -> Process QR Data -> Process Payment -> Redirect to Frontend

// Process QR Data
// http://localhost:3000/codescan/award/bounty123455

exports.processGiftCard = async (req, res) => {
  // Send A Gift Card
  // For later use........
};

exports.processPayment = async (amount, upiId) => {
  console.log("Processing Payment");
  console.log(`Paid ${amount} to ${upiId}`);
  return true;
};

// Process QR Data
exports.processQrScan = async (req, res) => {
  const bountyCode = req.originalUrl.split("/").pop();
  const code = await Code.findOne({ code: bountyCode }).populate("campaign");

  if (!code) {
    return res.json({ message: "Invalid Code" });
  }

  if (code.isUsed) {
    return res.json({ message: "Code Already Used" });
  }

  const { campaign } = code;

  const taskFunction = taskFunctionsMap[campaign.taskType];
  if (taskFunction) {
    const metaData = taskFunction(code);
    res.json({ campaign, ...metaData });
  } else {
    console.log(`Task type of  "${campaign.taskType}" not found`);
  }
};

exports.taskCompletion = async (req, res) => {
  const { code, name, email, phoneNo, upiId } = req.body;

  // Update Code Details
  const bountyCode = await Code.findOne({ code: code }).populate("campaign");
  if (!bountyCode) {
    return res.json({ message: "Invalid Code" });
  }
  if (bountyCode.isUsed) {
    return res.json({ message: "Code Already Used" });
  }
  // Process Payment
  const payment = await this.processPayment(
    bountyCode.campaign.totalAmount,
    upiId
  );
  if (!payment) {
    return res.json({ message: "Payment Failed" });
  }

  // Update Customer Details
  const customer = await Customer.findOne({
    phone_number: phoneNo,
  });
  let useCustomerId = null;
  if (customer) {
    useCustomerId = customer._id;
    customer.last_campaign_details = {
      campaign_id: bountyCode.campaign._id,
      details_user_shared: {
        name,
        email,
        phoneNo,
      },
      money_they_received: bountyCode.campaign.amount,
    };
  } else {
    const newCustomer = new Customer({
      full_name: name,
      phone_number: phoneNo,
      email: email,
      last_campaign_details: {
        campaign_id: bountyCode.campaign._id,
        details_user_shared: {
          name,
          email,
          phoneNo,
        },
        money_they_received: bountyCode.campaign.amount,
      },
    });
    useCustomerId = newCustomer._id;
    await newCustomer.save();
  }

  bountyCode.isUsed = true;
  bountyCode.usedBy = useCustomerId;
  bountyCode.usedAt = new Date();
  await bountyCode.save();

  res.json({ message: "Task Completed" });
};
