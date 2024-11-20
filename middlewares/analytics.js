const Analytics = require('../models/Analytics');

module.exports = async function (req, res, next) {
  // Log the request details
  await Analytics.create({
    action: req.method + ' ' + req.originalUrl,
    metadata: {
      user: req.user,
      body: req.body,
    },
  });
  next();
};
