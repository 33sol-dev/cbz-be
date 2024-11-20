const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/User');
require('../middlewares/passport-setup');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/**
 * @swagger
 * /auth/google:
 *   post:
 *     summary: Authenticate user via Google
 *     description: Authenticates a user using their Google ID token and returns a JWT for session management.
 *     tags:
 *       - GOOGLE SSO
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: Google ID token obtained from the client-side after Google Sign-In.
 *                 example: "eyJhbGciOiJSUzI1NiIsImtpZCI6Ij..."
 *             required:
 *               - idToken
 *     responses:
 *       '200':
 *         description: Authentication successful. Returns JWT and user information.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JSON Web Token (JWT) for authenticated sessions.
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Unique identifier for the user.
 *                       example: "60d5ec49f1d2c916c8f0e8b7"
 *                     full_name:
 *                       type: string
 *                       description: Full name of the user.
 *                       example: "John Doe"
 *                     email:
 *                       type: string
 *                       description: Email address of the user.
 *                       example: "john.doe@example.com"
 *                     avatar:
 *                       type: string
 *                       description: URL to the user's avatar image.
 *                       example: "https://example.com/avatar/johndoe.jpg"
 *       '400':
 *         description: Bad Request. Missing or invalid ID token.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid or missing ID token."
 *       '401':
 *         description: Unauthorized. Failed to authenticate the ID token.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid ID token."
 *       '500':
 *         description: Internal Server Error. An unexpected error occurred.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "An unexpected error occurred."
 */

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', 
    passport.authenticate('google', { failureRedirect: '/login' }),
    function(req, res) {
      logger.info("Setting user's session");
        // Successful authentication
        req.session.user = {
            id: req.user.id, // Assuming your user model has an id field
            username: req.user.username, // Username or any other user fields
            isLoggedIn: true
        };

        res.redirect('/dashboard'); // Redirect to a dashboard or other internal page
    }
);
/**
 * @swagger
 * auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 example: JohnDoe
 *               mobileNumber:
 *                 type: string
 *                 example: "918779780352"
 *               typeOfUser:
 *                 type: string
 *                 enum: [brand-admin, customer]
 *                 example: brand-admin
 *               upiId:
 *                 type: string
 *                 example: john@upi
 *               companyId:
 *                 type: string
 *                 example: "60f7c0b5d4d3c81234567890"
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
// Local Signup Route
router.post('/signup', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Check if a user with the given email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user instance
    const user = new User({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      emailVerified: false, // Set default values as needed
    });

    // Save the user to the database
    await user.save();

    // Set user session upon successful signup
    req.session.user = { id: user.id, email: user.email, isLoggedIn: true };

    res.status(201).json({ message: 'User created successfully', userId: user.id });
  } catch (error) {
    logger.error('Error in signup route:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: User login
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 example: "918779780352"
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email }).select('+password'); // Since password field is not selected by default
    if (!user) {
      return res.status(401).send({ message: 'User not found' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).send({ message: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { id: user.id }, // This is the payload to encode, typically user id or similar
      process.env.JWT_SECRET, // Secret key to sign the token
      { expiresIn: '1h' } // Options, e.g., token expiration
    );
    req.session.user = { id: user.id, username: user.username, isLoggedIn: true };

    res.send({ message: 'Logged in successfully', token });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});


router.get('/logout', (req, res) => {
  req.logout(function(err) {
    if (err) {
      logger.error('Error during logout:', err);
      return next(err); // Or handle error appropriately
    }
    req.session.destroy((err) => {
      if (err) {
        logger.error('Error destroying session:', err);
        return next(err); // Or handle error appropriately
      }
      res.clearCookie('connect.sid'); // Make sure to match the name of your session ID cookie
      res.redirect('/'); // Redirect to home page or login page
    });
  });
});

module.exports = router;
