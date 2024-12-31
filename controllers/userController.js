const User = require('../models/User');

exports.signup = async (req, res) => {
  const { username, email, password, companyId } = req.body;
  try {
    const user = new User({ username, email, password, company: companyId });
    await user.save();
    res.status(201).send({ message: "User created successfully", userId: user._id });
  } catch (error) {
    res.status(500).send(error);
  }
};

