const Beneficiary = require("../models/Beneficiary");
const Code = require("../models/Code");
const Customer = require("../models/Customer");


// You can add Different Task Functions as per the Added Task types in the Campaign
const taskFunctionsMap = {
  award: (code) => {

    // Redirect To URL to collect UPI Details
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
      redirectUrl: "http://localhost:3000/digital",
      action: null,
    };
  },
  social_media: (code) => {
    // redirect to social media sharing
    console.log("Sharing on social media");
    return {
      redirectUrl: "http://localhost:3000/social",
      action: null,
    };
  },
  location_sharing: (code) => {
    // redirect to location sharing
    console.log("Sharing location");
    return {
      redirectUrl: "http://localhost:3000/location",
      action: null,
    };
  },
};
// Frontend -> QR Code Scan -> Backend -> Process QR Data -> Process Payment -> Redirect to Frontend

// Process QR Data
// http://localhost:3000/codescan/award/bounty123455

exports.processPayment = async (amount,upiId) => {
  
  console.log("Processing Payment");
  console.log(`Paid ${amount} to ${upiId}`);
  return true;
};

// Process QR Data
exports.processQrScan = async (req, res) => {
  const bountyCode = req.originalUrl.split("/").pop();
  const code = await Code.findOne({ code: bountyCode }).populate("campaign");
  const { campaign } = code;

  const taskFunction = taskFunctionsMap[campaign.taskType];
  if (taskFunction) {
    const metaData = taskFunction(code);
    res.json({ ...code, ...metaData });
  } else {
    console.log(`Task type of  "${campaign.taskType}" not found`);
  }
};


exports.taskCompletion = async(req,res)=>{

  const {
    code,
    name,
    email,
    phoneNo,
    upiId,
  } = req.body;

  const bountyCode = await Code.findOne({ code: code }).populate("campaign");

  bountyCode.isUsed = true;
  bountyCode.usedBy = phoneNo;
  bountyCode.usedAt = new Date();
  await bountyCode.save();

  // Update Customer Details
  const customer = await Customer.findOne({
    phone_number: phoneNo,
  });

  if (customer) {
    customer.last_campaign_details = {
      campaign_id: bountyCode.campaign._id,
      details_user_shared: {
        name,
        email,
        phoneNo,
      },
      money_they_received: bountyCode.campaign.amount,
    };
  }else{
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
    await newCustomer.save();
  }

  // Process Payment
  await this.processPayment(bountyCode.campaign.amount,upiId);
  res.json({ message: "Task Completed" });

  // Task Completion
  console.log("Task Completed");
  return true;
}
