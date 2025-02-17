// middlewares/auth.js
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Authorization header missing or invalid');
    return res.status(401).json({ message: 'Unauthorized: Token missing or invalid' });
  }

  const token = authHeader.split(' ')[1]; // Extract the token

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach the decoded user information to the request
    next();
  } catch (error) {
    logger.error('JWT verification error:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Unauthorized: Token expired' });
    }
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};

module.exports = { verifyToken };