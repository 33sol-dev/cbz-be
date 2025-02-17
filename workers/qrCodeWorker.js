// workers/queueWorker.js (This file is correct and well-structured)
const Queue = require('bull');
const logger = require('../utils/logger');

try {
  // Initialize qrCodeQueue
  const qrCodeQueue = new Queue('qrCodeQueue', {
    redis: {
      host: '127.0.0.1', // Use localhost IP
      port: 6379,
    },
  });

  // Process qrCodeQueue
  qrCodeQueue.process('qrCodeGeneration', require('./qrCodeWorker'));

  // Initialize customerOnboardingQueue
  const customerOnboardingQueue = new Queue('customerOnboardingQueue', {
    redis: {
      host: '127.0.0.1',
      port: 6379,
    },
  });

  // Process customerOnboardingQueue
  customerOnboardingQueue.process('customerOnboarding', require('./customerOnboardingWorker'));

  // Event listeners for qrCodeQueue
  qrCodeQueue.on('completed', (job) => {
    logger.info(`QR Code Job completed: ${job.id}`);
  });

  qrCodeQueue.on('failed', (job, err) => {
    logger.error(`QR Code Job failed: ${job.id}, Error: ${err.message}`);
  });

  // Event listeners for customerOnboardingQueue
  customerOnboardingQueue.on('completed', (job) => {
    logger.info(`Customer Onboarding Job completed: ${job.id}`);
  });

  customerOnboardingQueue.on('failed', (job, err) => {
    logger.error(`Customer Onboarding Job failed: ${job.id}, Error: ${err.message}`);
  });

  logger.info('Queue workers are running...');

} catch (error) {
  logger.error('Error initializing queue workers:', error);
  process.exit(1); // Exit with an error code
}

// Graceful shutdown (optional, but good practice)
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1); // Exit with an error code
});