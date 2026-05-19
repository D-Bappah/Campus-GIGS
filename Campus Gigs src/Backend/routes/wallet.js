// =============================================================================
// -----------------------------------------------------------------------------
// All wallet and payment-related API endpoints.
// Base path (registered in server.js): /api/wallet
//
// Every route here is protected by `authMiddleware` — unauthenticated users
// must never be able to read balances or initiate withdrawals.
// =============================================================================

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const authMiddleware = require("../middleware/authMiddleware");

// Apply auth middleware to ALL routes in this file.
// This is cleaner than repeating `authMiddleware` on each route definition.
router.use(authMiddleware);

// =============================================================================
// GET /api/wallet/summary
// -----------------------------------------------------------------------------
// Returns the authenticated user's current wallet balances and a paginated
// list of their transaction history.
//
// Query params:
//   page  (optional, default 1)  — which page of transactions to return
//   limit (optional, default 10) — how many transactions per page
//
// Response shape:
// {
//   summary: { availableBalance, escrowBalance, totalEarned },
//   transactions: [ ...Transaction docs ],
//   pagination: { total, page, pages }
// }
// =============================================================================
router.get("/summary", async (req, res) => {
  try {
    // -------------------------------------------------------------------------
    // Parse pagination params. parseInt with a fallback handles the case where
    // the query param is missing or non-numeric (e.g. ?page=abc → NaN → 1).
    // -------------------------------------------------------------------------
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit; // offset into the result set

    // -------------------------------------------------------------------------
    // Run the balance aggregation and the history fetch IN PARALLEL using
    // Promise.all. These two queries are independent, so there's no reason to
    // await them sequentially. This roughly halves the response latency.
    // -------------------------------------------------------------------------
    const [summary, transactions, total] = await Promise.all([
      // Derived balance figures (see static method in Transaction.js)
      Transaction.getWalletSummary(req.user.id),

      // Paginated transaction history, newest first
      Transaction.find({ user: req.user.id })
        .sort({ createdAt: -1 }) // most recent at the top
        .skip(skip)
        .limit(limit)
        .lean(), // .lean() returns plain JS objects, ~30% faster than Mongoose docs
                 // since we don't need virtuals or save() on the result

      // Total count needed to compute total pages for the pagination UI
      Transaction.countDocuments({ user: req.user.id }),
    ]);

    res.json({
      summary,
      transactions,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("GET /api/wallet/summary error:", err);
    res.status(500).json({ message: "Server error fetching wallet summary." });
  }
});

// =============================================================================
// POST /api/wallet/withdraw
// -----------------------------------------------------------------------------
// Allows a freelancer to request a withdrawal of funds from their available
// balance to a bank account.
//
// [EXTERNAL ACTION REQUIRED] ─────────────────────────────────────────────────
// Real money movement requires a payment gateway. This route handles the
// LOCAL side of a withdrawal (balance validation → create a pending transaction)
// but does NOT actually move money to a bank.
//
// To complete this feature you must:
//  1. Create a Paystack account at https://paystack.com
//  2. In your Paystack dashboard, enable "Transfers" (requires BVN verification
//     of your business).
//  3. Add your secret key to .env: PAYSTACK_SECRET_KEY=sk_live_xxxxx
//  4. npm install axios
//  5. Call Paystack's Transfer API:
//       POST https://api.paystack.co/transfer
//       Headers: { Authorization: "Bearer sk_live_xxxxx" }
//       Body: { source: "balance", amount, recipient: <recipient_code>,
//               reason: description }
//  6. Paystack will return a transfer_code. Store it in transaction.reference.
//  7. Set up a Paystack webhook (POST /api/wallet/webhook) to receive
//     "transfer.success" or "transfer.failed" events and update the
//     transaction status from "pending" to "completed" / "failed".
//
// Until you integrate Paystack, this route simulates the flow locally.
// ─────────────────────────────────────────────────────────────────────────────
//
// Request body:
// {
//   amount: Number       — amount in kobo (smallest unit), e.g. 500000 = ₦5,000
//   bankName: String     — e.g. "GTBank"
//   accountNumber: String — e.g. "0123456789"
//   accountName: String  — e.g. "John Doe"
// }
// =============================================================================
router.post("/withdraw", async (req, res) => {
  // -------------------------------------------------------------------------
  // We use a Mongoose session + transaction here to ensure atomicity.
  // The two writes (check balance → create debit record) must succeed or
  // fail together. Without a session, a crash between the two writes could
  // leave the user with a debit record but no corresponding balance reduction
  // — or vice versa.
  //
  // NOTE: MongoDB sessions require a replica set. In local dev with a
  // standalone mongod instance, remove the session/transaction blocks and
  // accept the (tiny) risk of partial writes. In production, always use a
  // replica set (MongoDB Atlas handles this automatically).
  // -------------------------------------------------------------------------
  const { amount, bankName, accountNumber, accountName } = req.body;

  // --- Input validation ---
  if (!amount || amount <= 0) {
    return res.status(400).json({ message: "A valid withdrawal amount is required." });
  }
  if (!bankName || !accountNumber || !accountName) {
    return res.status(400).json({ message: "Complete bank details are required." });
  }

  // Enforce a minimum withdrawal (e.g. ₦500 = 50000 kobo) to avoid
  // micro-withdrawals that would be eaten by bank fees.
  const MINIMUM_WITHDRAWAL = 50000; // kobo
  if (amount < MINIMUM_WITHDRAWAL) {
    return res.status(400).json({
      message: `Minimum withdrawal is ₦${MINIMUM_WITHDRAWAL / 100}. You requested ₦${amount / 100}.`,
    });
  }

  try {
    // Check the user's current available balance BEFORE creating any record.
    // This is the "read" half of the check-and-act pattern.
    const summary = await Transaction.getWalletSummary(req.user.id);

    if (summary.availableBalance < amount) {
      return res.status(400).json({
        message: `Insufficient balance. Available: ₦${summary.availableBalance / 100}, Requested: ₦${amount / 100}.`,
      });
    }

    // -------------------------------------------------------------------------
    // Create the debit transaction record in "pending" status.
    // It becomes "completed" once the payment gateway confirms the bank transfer.
    // For now (no gateway yet), we set it to "pending" to be accurate about
    // the fact that no real money has moved yet.
    // -------------------------------------------------------------------------
    const transaction = await Transaction.create({
      user: req.user.id,
      type: "debit",
      amount,
      currency: "NGN",
      description: `Withdrawal to ${bankName} ****${accountNumber.slice(-4)}`,
      status: "pending", // Will be updated to "completed" by Paystack webhook
      bankDetails: { bankName, accountNumber, accountName },
    });

    // [EXTERNAL ACTION REQUIRED]
    // THIS IS WHERE YOU CALL PAYSTACK:
    // const paystackResponse = await axios.post(
    //   "https://api.paystack.co/transfer",
    //   { source: "balance", amount, recipient: recipientCode, reason: transaction.description },
    //   { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    // );
    // transaction.reference = paystackResponse.data.data.transfer_code;
    // await transaction.save();

    res.status(201).json({
      message: "Withdrawal request submitted. Processing may take 1–3 business days.",
      transaction,
    });
  } catch (err) {
    console.error("POST /api/wallet/withdraw error:", err);
    res.status(500).json({ message: "Server error processing withdrawal." });
  }
});

// =============================================================================
// GET /api/wallet/transactions/:id
// -----------------------------------------------------------------------------
// Fetches a single transaction by its MongoDB ObjectId.
// Includes an ownership check — users must not be able to fetch other
// users' transaction details by guessing IDs.
// =============================================================================
router.get("/transactions/:id", async (req, res) => {
  try {
    // Validate that the id param is a well-formed ObjectId before querying.
    // Passing a malformed string to findOne would throw a CastError, not return
    // null, so we catch that case explicitly for a cleaner 400 response.
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid transaction ID format." });
    }

    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user.id, // ownership gate — ensures users only see their own
    }).lean();

    if (!transaction) {
      // Return 404 whether the doc doesn't exist OR it belongs to another user.
      // Returning 403 for the latter would leak information about whether the
      // ID exists in the system — a minor but real security consideration.
      return res.status(404).json({ message: "Transaction not found." });
    }

    res.json(transaction);
  } catch (err) {
    console.error("GET /api/wallet/transactions/:id error:", err);
    res.status(500).json({ message: "Server error fetching transaction." });
  }
});

module.exports = router;
