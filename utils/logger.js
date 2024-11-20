// utils/logger.js

const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
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
    // Add file transports if needed
  ],
});

module.exports = logger;


