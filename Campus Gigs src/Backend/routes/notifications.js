const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const authMiddleware = require('../middleware/authMiddleware');

// @route   GET /api/notifications
// @desc    Get paginated notifications for the logged-in user
router.get('/', authMiddleware, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const notifications = await Notification.find({ recipient: req.user.id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Notification.countDocuments({ recipient: req.user.id });
        const unreadCount = await Notification.countDocuments({ recipient: req.user.id, read: false });

        res.json({
            notifications,
            unreadCount,
            pagination: {
                page,
                pages: Math.ceil(total / limit) || 1,
                total
            }
        });
    } catch (err) {
        console.error("Notifications Error:", err);
        res.status(500).json({ message: "Server error fetching notifications." });
    }
});

// @route   PUT /api/notifications/:id/read
// @desc    Mark a single notification as read
router.put('/:id/read', authMiddleware, async (req, res) => {
    try {
        await Notification.findOneAndUpdate(
            { _id: req.params.id, recipient: req.user.id },
            { read: true }
        );
        res.json({ message: "Marked as read" });
    } catch (err) {
        res.status(500).json({ message: "Server error." });
    }
});

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read for the user
router.put('/read-all', authMiddleware, async (req, res) => {
    try {
        await Notification.updateMany(
            { recipient: req.user.id, read: false },
            { read: true }
        );
        res.json({ message: "All notifications marked as read" });
    } catch (err) {
        res.status(500).json({ message: "Server error." });
    }
});

module.exports = router;