// db.js
require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('./utils/logger');

const connectDB = async () => {
  mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => logger.info("MongoDB Connected"))
  .catch((err) => logger.error("MongoDB connection error:", err));
};

module.exports = connectDB;
