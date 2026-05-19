const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const authMiddleware = require('../middleware/authMiddleware');

// @route   GET /api/wallet/summary
// @desc    Calculate balances and fetch paginated transaction history
router.get('/summary', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // 1. Fetch the paginated history for the table
        const transactions = await Transaction.find({ user: userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Transaction.countDocuments({ user: userId });

        // 2. Fetch all completed transactions to calculate the user's balances
        const allTx = await Transaction.find({ user: userId, status: 'completed' });
        
        let calcAvailable = 0;
        let calcEscrow = 0;
        let calcTotal = 0;

        allTx.forEach(tx => {
            if (tx.type === 'escrow_in') {
                calcEscrow += tx.amount;
            } else if (tx.type === 'escrow_out') {
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

        // 3. Send the formatted payload exactly as payment.js expects it
        res.json({
            summary: {
                availableBalance: calcAvailable,
                escrowBalance: calcEscrow,
                totalEarned: calcTotal
            },
            transactions,
            pagination: {
                page,
                pages: Math.ceil(total / limit) || 1,
                total
            }
        });
    } catch (err) {
        console.error("Wallet Summary Error:", err);
        res.status(500).json({ message: "Server error fetching wallet data." });
    }
});

// @route   POST /api/wallet/withdraw
// @desc    Process a freelancer withdrawal request
router.post('/withdraw', authMiddleware, async (req, res) => {
    try {
        const { amount, bankName, accountNumber, accountName } = req.body;
        
        // Create a 'pending' debit transaction
        const withdrawal = await Transaction.create({
            user: req.user.id,
            type: "debit",
            amount: amount,
            currency: "NGN",
            description: `Withdrawal to ${bankName} ****${accountNumber.slice(-4)}`,
            status: "pending", // Stays pending until Admin/Paystack approves it
            bankDetails: { bankName, accountNumber, accountName }
        });

        res.json({ 
            message: "Withdrawal request submitted! Funds will be processed shortly.", 
            transaction: withdrawal 
        });
    } catch (err) {
        console.error("Withdrawal Error:", err);
        res.status(500).json({ message: "Server error processing withdrawal." });
    }
});

// @route   GET /api/wallet/transactions/:id
// @desc    Get details for a single transaction (for the popup modal)
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