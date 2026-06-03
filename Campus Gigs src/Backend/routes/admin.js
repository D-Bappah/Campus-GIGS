const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Job = require('../models/Job');
const Contract = require('../models/Contract');
const Transaction = require('../models/Transaction');
const authMiddleware = require('../middleware/authMiddleware');

function adminOnly(req, res, next) {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required." });
    }
    next();
}

router.use(authMiddleware, adminOnly);

// Platform-wide stats
router.get('/stats', async (req, res) => {
    try {
        const [totalUsers, activeJobs, completedContracts, pendingWithdrawals] = await Promise.all([
            User.countDocuments(),
            Job.countDocuments({ status: 'open' }),
            Contract.countDocuments({ status: 'completed' }),
            Transaction.find({ type: 'debit', status: 'pending' })
        ]);

        const totalRevenue = await Transaction.aggregate([
            { $match: { type: 'escrow_out', status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const pendingPayoutTotal = pendingWithdrawals.reduce((s, t) => s + t.amount, 0);

        res.json({
            totalUsers,
            activeJobs,
            completedContracts,
            pendingPayouts: pendingWithdrawals.length,
            pendingPayoutAmount: pendingPayoutTotal,
            totalRevenue: totalRevenue[0]?.total || 0
        });
    } catch (err) {
        res.status(500).json({ message: "Error fetching stats." });
    }
});

// Recent job postings
router.get('/jobs', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const jobs = await Job.find()
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('postedBy', 'email firstName lastName displayName')
            .lean();
        res.json(jobs);
    } catch (err) {
        res.status(500).json({ message: "Error fetching jobs." });
    }
});

// Recent user signups
router.get('/users', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const users = await User.find()
            .sort({ createdAt: -1 })
            .limit(limit)
            .select('email firstName lastName displayName role createdAt isVerified')
            .lean();
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: "Error fetching users." });
    }
});

// Pending withdrawal requests
router.get('/withdrawals', async (req, res) => {
    try {
        const withdrawals = await Transaction.find({ type: 'debit', status: 'pending' })
            .sort({ createdAt: -1 })
            .populate('user', 'email firstName lastName displayName')
            .lean();
        res.json(withdrawals);
    } catch (err) {
        res.status(500).json({ message: "Error fetching withdrawals." });
    }
});

// Approve or reject a pending withdrawal manually
router.put('/withdrawals/:id', async (req, res) => {
    try {
        const { action } = req.body;
        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ message: "Action must be 'approve' or 'reject'." });
        }

        const tx = await Transaction.findOneAndUpdate(
            { _id: req.params.id, type: 'debit', status: 'pending' },
            { status: action === 'approve' ? 'completed' : 'failed' },
            { new: true }
        );

        if (!tx) return res.status(404).json({ message: "Pending withdrawal not found." });
        res.json({ message: `Withdrawal ${action}d.`, transaction: tx });
    } catch (err) {
        res.status(500).json({ message: "Error updating withdrawal." });
    }
});

// Disputed contracts
router.get('/disputes', async (req, res) => {
    try {
        const disputes = await Contract.find({ status: 'disputed' })
            .sort({ updatedAt: -1 })
            .populate('job', 'title')
            .populate('client', 'email firstName lastName')
            .populate('freelancer', 'email firstName lastName')
            .lean();
        res.json(disputes);
    } catch (err) {
        res.status(500).json({ message: "Error fetching disputes." });
    }
});

module.exports = router;
