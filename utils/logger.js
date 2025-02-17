// utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }), // Log stack traces for errors
    // utils/logger.js (continued)
    winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }), // Handle metadata
    winston.format.printf(({ timestamp, level, message, metadata }) => {
      let metaString = '';
      if (metadata && Object.keys(metadata).length) {
        metaString = JSON.stringify(metadata);
      }
      return `${timestamp} [${level}]: ${message} ${metaString}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    // Add file transports if needed (e.g., for production logging)
    // new winston.transports.File({ filename: 'error.log', level: 'error' }),
    // new winston.transports.File({ filename: 'combined.log' }),
  ],
});

module.exports = logger;