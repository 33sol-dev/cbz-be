const SampleCode = require("../models/SampleCode");



exports.generateUniqueCode = async () => {
  let code;
  let exists = true;

  while (exists) {
    code = "BOUNTY" + Math.floor(100000 + Math.random() * 900000); // 6-digit number
    exists = await SampleCode.exists({ code });
  }

  return code;
};
