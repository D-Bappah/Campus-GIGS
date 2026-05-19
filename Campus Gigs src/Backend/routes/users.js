const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
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

// @route   PUT /api/users/me
// @desc    Update current user's profile data
// @access  Private (Requires Token)
router.put('/me', auth, async (req, res) => {
    // Destructure the fields we expect from the frontend
    const { 
        firstName, 
        lastName, 
        displayName, 
        shortBio, 
        department, 
        skillProficiency, 
        hoursPerWeek,
        preferredWorkType,
        hourlyRange, 
        yearOfStudy,
        expectedGraduation
    } = req.body;

    // Build a profile object containing only the fields that were actually sent
    const profileFields = {};
    if (firstName) profileFields.firstName = firstName;
    if (lastName) profileFields.lastName = lastName;
    if (displayName) profileFields.displayName = displayName;
    if (shortBio) profileFields.shortBio = shortBio;
    if (department) profileFields.department = department;
    if (skillProficiency) profileFields.skillProficiency = skillProficiency;
    if (hoursPerWeek) profileFields.hoursPerWeek = hoursPerWeek;
    if (preferredWorkType) profileFields.preferredWorkType = preferredWorkType;
    if (hourlyRange) profileFields.hourlyRange = hourlyRange;
    if (yearOfStudy) profileFields.yearOfStudy = yearOfStudy;
    if (expectedGraduation) profileFields.expectedGraduation = expectedGraduation;
    

    try {
        // 3. Find the user
        let user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // 4. Update the user document in MongoDB
        user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: profileFields },
            { new: true } // This option tells Mongoose to return the updated document
        ).select('-password'); // Exclude the password from the response

        // 5. Send the updated user back to the frontend
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;