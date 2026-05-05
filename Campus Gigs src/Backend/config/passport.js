//Tells Passport how to talk to GitHub and what to do when GitHub sends the user's profile back
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const User = require('../models/User');

passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: "http://localhost:5000/api/auth/github/callback",
    passReqToCallback: true // Allows the passage of the JWT token through the request
  },
  async function(req, accessToken, refreshToken, profile, done) {
    try {
        //Passes the user's JWT in a query string so we know WHO is linking the account
        const userId = req.query.state; 

        if (!userId) {
            return done(new Error("No user ID provided"), null);
        }

        // Find the logged-in user and update their document with GitHub info
        const user = await User.findByIdAndUpdate(
            userId, 
            {
                githubId: profile.id,
                githubUsername: profile.username,
                githubConnected: true
            },
            { new: true }
        );

        return done(null, user);
    } catch (err) {
        return done(err, null);
    }
  }
));

module.exports = passport;