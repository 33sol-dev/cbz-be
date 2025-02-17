//middlewares/passport-setup.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User'); // Import your User model
require("dotenv").config();
// Serialize user into the session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// Configure Google OAuth 2.0 strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback", // Ensure this matches your Google OAuth settings
    passReqToCallback: true
},
    async (req, accessToken, refreshToken, profile, done) => {
        try {
            // Find or create the user in your database
            let user = await User.findOne({ googleId: profile.id });

            if (!user) {
                // Create a new user if one doesn't exist
                user = new User({
                    googleId: profile.id,
                    firstName: profile.name.givenName,
                    lastName: profile.name.familyName,
                    email: profile.emails[0].value,
                    emailVerified: profile.emails[0].verified,
                    profilePicture: profile.photos[0].value,
                    // You can add other fields here as needed
                });
                await user.save();
            }

            // Pass the user to the next middleware
            done(null, user);
        } catch (error) {
            done(error, null);
        }
    }
));