// config/constants.js
require("dotenv").config();

module.exports = {
    whitelist: [
        "http://localhost:3000",
        "https://bountyfe-git-auth-omchillures-projects.vercel.app",
        "https://bountyfe.vercel.app",
        "https://app.huntbounty.xyz",
        "https://bounty-form.vercel.app",
        "http://localhost:3001"
      ],
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    whatsappApiUrl: process.env.WHATSAPP_API_URL,
    whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    taskUrl: process.env.TASK_URL
}