const Code = require("../models/Code");

// You can add Different Task Functions as per the Added Task types in the Campaign
const taskFunctionsMap = {
  award: () => {
    console.log("Awarding points");
  },
  digital_activation: () => {
    // Sending Money To beneficiary
    console.log("Activating digital");
  },
  social_media: () => {
    // redirect to social media sharing
    console.log("Sharing on social media");
  },
  location_sharing: () => {
    // redirect to location sharing
    console.log("Sharing location");
  },
};
// Frontend -> QR Code Scan -> Backend -> Process QR Data -> Process Payment -> Redirect to Frontend

// Process QR Data
// http://localhost:3000/codescan/award/bounty123455


exports.processPayment = async ({customerDetails}) => {
  // Payment Logic
  
  console.log("Processing Payment");
};


// Process QR Data
exports.processQrScan = async (req, res) => {
  const bountyCode = req.originalUrl.split("/").pop();
  const code = await Code.findOne({ code: bountyCode }).populate("campaign");
  const { campaign } = code;

  const taskFunction = taskFunctionsMap[campaign.taskType];
  if (taskFunction) {
    taskFunction();
  } else {
    console.log(`Task type of  "${campaign.taskType}" not found`);
  }

  res.json({
    ...code._doc,
    redirectUrl: "https://localhost:3000/",
  });
};
