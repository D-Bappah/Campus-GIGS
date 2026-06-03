const express = require('express');
const router = express.Router();
const Application = require('../models/Application');
const Contract = require('../models/Contract');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/me', authMiddleware, async (req, res) => {
    try {
        const applications = await Application.find({ applicant: req.user.id })
            .populate('job', 'title status budget deliveryDays')
            .sort({ createdAt: -1 })
            .lean();

        // For accepted applications, attach the matching contract ID
        const withContracts = await Promise.all(applications.map(async (app) => {
            if (app.status === 'accepted') {
                const contract = await Contract.findOne({ application: app._id }).select('_id status').lean();
                app.contractId = contract?._id || null;
                app.contractStatus = contract?.status || null;
            }
            return app;
        }));

        res.json(withContracts);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error fetching applications." });
    }
});

module.exports = router;
