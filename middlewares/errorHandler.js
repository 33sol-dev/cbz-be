// middlewares/errorHandler.js
const logger = require('../utils/logger'); // Adjust the path as needed

module.exports = (err, req, res, next) => {
    logger.error(err.stack);
    res.status(500).json({ message: err.message });
  };
  