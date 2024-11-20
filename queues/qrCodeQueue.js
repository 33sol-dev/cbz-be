// queues/qrCodeQueue.js

const Queue = require('bull');

// Create a Bull queue
const qrCodeQueue = new Queue('qrCodeQueue', {
  redis: {
    host: 'localhost',
    port: 6379,
    // Add your Redis configuration if needed
  },
});

// Export the queue for adding jobs
module.exports = qrCodeQueue;
