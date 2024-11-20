// models/User.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, sparse: true },
  email: { type: String, unique: true, sparse: true},
  password: { type: String, select: false },
  phoneNumber: { type: String, unique: true, sparse: true },
  typeOfUser: String,
  upiId: String,
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  googleId: { type: String, unique: true, sparse: true },
  firstName: { type: String },
  lastName: { type: String },
  emailVerified: { type: Boolean, default: false },
  profilePicture: String,
});

const User = mongoose.model('User', userSchema);

module.exports = User;
