// models/User.js
const mongoose = require('mongoose');
// const bcrypt = require('bcryptjs');  // If you're using bcrypt for password hashing

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, sparse: true }, // sparse: true allows multiple null values
  email: { type: String, unique: true, sparse: true },    // sparse: true allows multiple null values
  password: { type: String, select: false }, // select: false prevents the password from being returned by default
  phoneNumber: { type: String, unique: true, sparse: true }, // sparse: true allows multiple null values
  typeOfUser: String,
  upiId: String,
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  googleId: { type: String, unique: true, sparse: true }, // sparse: true allows multiple null values
  firstName: { type: String },
  lastName: { type: String },
  emailVerified: { type: Boolean, default: false },
  profilePicture: String,
});

const User = mongoose.model('User', userSchema);

module.exports = User;