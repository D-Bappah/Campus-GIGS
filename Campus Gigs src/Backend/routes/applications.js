const express = require('express');
const router = express.Router();
const Application = require('../models/Application');
const authMiddleware = require('../middleware/authMiddleware');

// @route   GET /api/applications/me
// @desc    Get all applications submitted by the logged-in freelancer
router.get('/me', authMiddleware, async (req, res) => {
    try {
        // Find applications where the applicant is the logged-in user
        const applications = await Application.find({ applicant: req.user.id })
            .populate('job', 'title status budget deliveryDays')
            .sort({ createdAt: -1 });

        res.json(applications);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error fetching applications." });
    }
});

module.exports = router;