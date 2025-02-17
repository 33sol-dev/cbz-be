// utils/pinGenerator.js
function generateRandomPin() {
  return Math.floor(1000 + Math.random() * 9000).toString(); // Generate a 4-digit PIN
}
module.exports = { generateRandomPin };