const express = require('express');
const router = express.Router();
const auth = require('../middleware/authmiddleware');
const User = require('../models/User'); // Adjust path to your User model

// @route   GET /api/users/me
// @desc    Get current user's profile data
// @access  Private (Requires Token)
router.get('/me', auth, async (req, res) => {
    try {
        // Find the user by the ID embedded in the token. 
        // We use .select('-password') so we don't accidentally send the hashed password to the frontend!
        const user = await User.findById(req.user.id).select('-password');
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;