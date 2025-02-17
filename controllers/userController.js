// controllers/userController.js
const User = require('../models/User');
const { validationResult } = require('express-validator');

exports.signup = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, companyId } = req.body;
    try {
        const user = new User({ username, email, password, company: companyId });
        await user.save();
        res.status(201).send({ message: "User created successfully", userId: user._id });
    } catch (error) {
        res.status(500).send(error);
    }
};


exports.login = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
  };
  
exports.getUserProfile = (req,res) => {

}