const express = require('express');
const router = express.Router();
const passport = require('passport');

// @route   GET /api/auth/github
// @desc    Trigger the GitHub OAuth screen
router.get('/github', (req, res, next) => {
    // The frontend must send the user's database ID in the query string
    // e.g., /api/auth/github?userId=12345
    const userId = req.query.userId; 

    //Pass the userId into the 'state' parameter so GitHub hands it back to us later
    passport.authenticate('github', { scope: [ 'user:email' ], state: userId })(req, res, next);
});

// @route   GET /api/auth/github/callback
// @desc    GitHub redirects here after the user clicks "Authorize"
router.get('/github/callback', 
    passport.authenticate('github', { session: false, failureRedirect: 'http://localhost:5500/settings.html?error=github' }),
    (req, res) => {
        // If successful, redirect the user back to the frontend settings page
        res.redirect('http://localhost:5500/settings.html?github=success');
    }
);

module.exports = router;