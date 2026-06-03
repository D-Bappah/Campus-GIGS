const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const socketUtil = require('../utils/socket');
const notify = require('../utils/notificationHelper');

router.get('/conversations', authMiddleware, async (req, res) => {
    try {
        const messages = await Message.find({
            $or: [{ sender: req.user.id }, { receiver: req.user.id }]
        }).sort({ createdAt: -1 }).populate('sender receiver', 'displayName firstName lastName avatarUrl university');

        const conversationsMap = new Map();

        messages.forEach(msg => {
            const partnerId = msg.sender._id.toString() === req.user.id
                ? msg.receiver._id.toString()
                : msg.sender._id.toString();

            if (!conversationsMap.has(partnerId)) {
                conversationsMap.set(partnerId, {
                    senderProfile: msg.sender,
                    receiverProfile: msg.receiver,
                    lastMessage: msg,
                    unreadCount: (msg.receiver._id.toString() === req.user.id && !msg.read) ? 1 : 0
                });
            } else {
                if (msg.receiver._id.toString() === req.user.id && !msg.read) {
                    conversationsMap.get(partnerId).unreadCount++;
                }
            }
        });

        res.json({ conversations: Array.from(conversationsMap.values()) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error fetching conversations." });
    }
});

router.get('/:otherUserId', authMiddleware, async (req, res) => {
    try {
        const otherUser = await User.findById(req.params.otherUserId).select('displayName firstName lastName avatarUrl university');

        const messages = await Message.find({
            $or: [
                { sender: req.user.id, receiver: req.params.otherUserId },
                { sender: req.params.otherUserId, receiver: req.user.id }
            ]
        }).sort({ createdAt: 1 }).populate('sender', 'displayName firstName lastName avatarUrl');

        await Message.updateMany(
            { sender: req.params.otherUserId, receiver: req.user.id, read: false },
            { $set: { read: true } }
        );

        res.json({ messages, otherUser });
    } catch (err) {
        res.status(500).json({ message: "Server error fetching chat." });
    }
});

router.post('/:otherUserId', authMiddleware, async (req, res) => {
    try {
        const { text } = req.body;
        const convId = [req.user.id, req.params.otherUserId].sort().join("_");

        const newMessage = await Message.create({
            conversationId: convId,
            sender: req.user.id,
            receiver: req.params.otherUserId,
            text,
            read: false
        });

        await newMessage.populate('sender', 'displayName firstName lastName avatarUrl');

        // Emit to the conversation room so both parties get it instantly
        const io = socketUtil.get();
        io?.to(convId).emit('new_message', newMessage);

        // Notify receiver if they're not in the socket room (offline fallback)
        const sender = await User.findById(req.user.id).select('firstName lastName displayName');
        const senderName = sender?.displayName || sender?.firstName || 'Someone';
        notify.newMessage(req.params.otherUserId, senderName);

        res.status(201).json(newMessage);
    } catch (err) {
        res.status(500).json({ message: "Server error sending message." });
    }
});

module.exports = router;
