module.exports = (err, req, res, next) => {
    logger.info("Hello");
    logger.info(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
};
  