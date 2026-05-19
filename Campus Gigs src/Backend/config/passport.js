//Tells Passport how to talk to GitHub and what to do when GitHub sends the user's profile back
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const User = require('../models/User');

const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } = process.env;

// Prevent the whole server from crashing if OAuth env vars aren't configured yet.
if (GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
        callbackURL: "http://localhost:5000/api/auth/github/callback",
        passReqToCallback: true // Allows the passage of the JWT token through the request
      },
      async function (req, accessToken, refreshToken, profile, done) {
        try {
          // Passes the user's JWT in a query string so we know WHO is linking the account
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
    )
  );
} else {
  console.warn(
    "[passport] GitHub OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env to enable GitHub login."
  );
}


module.exports = passport;