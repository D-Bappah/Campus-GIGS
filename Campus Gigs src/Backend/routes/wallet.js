const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const Transaction = require('../models/Transaction');
const authMiddleware = require('../middleware/authMiddleware');
const notify = require('../utils/notificationHelper');

const PAYSTACK_BASE = 'https://api.paystack.co';
const paystackHeaders = () => ({
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json'
});

router.get('/summary', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const transactions = await Transaction.find({ user: userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Transaction.countDocuments({ user: userId });
        const allTx = await Transaction.find({ user: userId, status: 'completed' });

        let calcAvailable = 0, calcEscrow = 0, calcTotal = 0;

        allTx.forEach(tx => {
            if (tx.type === 'escrow_in') calcEscrow += tx.amount;
            else if (tx.type === 'escrow_out') {
                calcEscrow -= tx.amount;
                calcAvailable += tx.amount;
                calcTotal += tx.amount;
            } else if (tx.type === 'credit') {
                calcAvailable += tx.amount;
                calcTotal += tx.amount;
            } else if (tx.type === 'debit') {
                calcAvailable -= tx.amount;
            }
        });

        res.json({
            summary: { availableBalance: calcAvailable, escrowBalance: calcEscrow, totalEarned: calcTotal },
            transactions,
            pagination: { page, pages: Math.ceil(total / limit) || 1, total }
        });
    } catch (err) {
        console.error("Wallet Summary Error:", err);
        res.status(500).json({ message: "Server error fetching wallet data." });
    }
});

// Resolve a bank account number to get the account name (verify before creating recipient)
router.post('/resolve-account', authMiddleware, async (req, res) => {
    try {
        const { accountNumber, bankCode } = req.body;
        const { data } = await axios.get(
            `${PAYSTACK_BASE}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
            { headers: paystackHeaders() }
        );
        res.json(data.data);
    } catch (err) {
        const msg = err.response?.data?.message || "Could not resolve account.";
        res.status(400).json({ message: msg });
    }
});

// List Nigerian banks from Paystack (for the bank select dropdown)
router.get('/banks', authMiddleware, async (req, res) => {
    try {
        const { data } = await axios.get(`${PAYSTACK_BASE}/bank?country=nigeria&perPage=100`, {
            headers: paystackHeaders()
        });
        res.json(data.data);
    } catch (err) {
        res.status(500).json({ message: "Could not fetch bank list." });
    }
});

router.post('/withdraw', authMiddleware, async (req, res) => {
    try {
        const { amount, bankName, accountNumber, accountName, bankCode } = req.body;

        if (!amount || amount <= 0) return res.status(400).json({ message: "Invalid amount." });
        if (!bankCode) return res.status(400).json({ message: "Bank code required." });

        const withdrawal = await Transaction.create({
            user: req.user.id,
            type: "debit",
            amount,
            currency: "NGN",
            description: `Withdrawal to ${bankName} ****${accountNumber.slice(-4)}`,
            status: "pending",
            bankDetails: { bankName, accountNumber, accountName }
        });

        res.json({
            message: "Withdrawal request submitted! Processing…",
            transaction: withdrawal
        });

        // Simulate Paystack confirming the transfer after 6 seconds
        setTimeout(async () => {
            try {
                await Transaction.findByIdAndUpdate(withdrawal._id, { status: 'completed' });
                notify.withdrawalProcessed(req.user.id, Math.round(amount / 100));
            } catch (e) {
                console.error('Auto-complete withdrawal failed:', e.message);
            }
        }, 6000);

    } catch (err) {
        console.error("Withdrawal Error:", err.message);
        res.status(500).json({ message: "Server error processing withdrawal." });
    }
});

// Paystack webhook — confirms transfer status changes
router.post('/webhook/paystack', express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers['x-paystack-signature'];
    const hash = crypto
        .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
        .update(req.body)
        .digest('hex');

    if (hash !== signature) return res.status(401).send('Invalid signature');

    res.sendStatus(200);

    const event = JSON.parse(req.body);

    if (event.event === 'transfer.success' || event.event === 'transfer.failed') {
        const transferCode = event.data.transfer_code;
        const newStatus = event.event === 'transfer.success' ? 'completed' : 'failed';

        const tx = await Transaction.findOneAndUpdate(
            { reference: transferCode },
            { status: newStatus },
            { new: true }
        );

        if (tx && newStatus === 'completed') {
            notify.withdrawalProcessed(tx.user, Math.round(tx.amount / 100));
        }
    }
});

router.get('/transactions/:id', authMiddleware, async (req, res) => {
    try {
        const tx = await Transaction.findOne({ _id: req.params.id, user: req.user.id });
        if (!tx) return res.status(404).json({ message: "Transaction not found." });
        res.json(tx);
    } catch (err) {
        res.status(500).json({ message: "Server error." });
    }
});

module.exports = router;
