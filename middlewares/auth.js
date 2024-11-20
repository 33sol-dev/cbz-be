const jwt = require('jsonwebtoken');
const logger = require('../utils/logger'); // Adjust the path as needed

exports.verifyToken = (req, res, next) => {
    
    const token = req.headers.authorization?.split(' ')[1];
    console.log('Received Token:', token);
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            logger.error("JWT Verification Error:", err);
            return res.status(401).json({ message: "Invalid token" });
        }
        req.user = decoded;
        next();
    });
};

exports.isAuthenticated = (req, res, next) => {
    if (req.session.user && req.session.user.isLoggedIn) {
        next();
    } else {
        res.status(401).send({ message: 'User is not authenticated' });
    }
};
