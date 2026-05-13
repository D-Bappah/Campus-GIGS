// =============================================================================
// models/Transaction.js
// -----------------------------------------------------------------------------
// Represents a single financial event on a user's wallet. Every credit and
// debit is stored as an immutable record here — we never mutate balances
// directly on the User model. Instead, we derive the current balance by
// summing all transactions for a given user. This audit-trail approach means
// we can always reconstruct history and debug discrepancies.
// =============================================================================

const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema(
  {
    // -------------------------------------------------------------------------
    // owner — which user's wallet this transaction belongs to.
    // Indexed because nearly every query filters by this field first.
    // -------------------------------------------------------------------------
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // -------------------------------------------------------------------------
    // type — the direction and nature of the money movement.
    //
    //  "credit"     → money coming IN  (e.g. client pays for a completed job)
    //  "debit"      → money going OUT  (e.g. freelancer withdraws to bank)
    //  "escrow_in"  → funds locked in escrow when a contract is created
    //  "escrow_out" → funds released from escrow to freelancer on completion
    //
    // We store the semantic type rather than just a +/- amount so that the UI
    // can render meaningful labels ("Payment Received", "Withdrawal", etc.)
    // -------------------------------------------------------------------------
    type: {
      type: String,
      enum: ["credit", "debit", "escrow_in", "escrow_out"],
      required: true,
    },

    // -------------------------------------------------------------------------
    // amount — always a POSITIVE number regardless of direction. The `type`
    // field conveys direction. Storing negatives would make summing queries
    // error-prone and harder to validate.
    // Stored in the smallest currency unit (kobo for NGN / cents for USD)
    // to avoid floating-point rounding issues.
    // -------------------------------------------------------------------------
    amount: {
      type: Number,
      required: true,
      min: [1, "Transaction amount must be at least 1 (in base currency unit)"],
    },

    // -------------------------------------------------------------------------
    // currency — ISO 4217 code. Defaulting to NGN since the target market is
    // Nigerian universities, but the schema is currency-agnostic for future use.
    // -------------------------------------------------------------------------
    currency: {
      type: String,
      default: "NGN",
      uppercase: true,
    },

    // -------------------------------------------------------------------------
    // description — a human-readable label shown in the transaction history UI.
    // Examples: "Payment for Logo Design", "Withdrawal to GTBank ****1234"
    // -------------------------------------------------------------------------
    description: {
      type: String,
      required: true,
      trim: true,
    },

    // -------------------------------------------------------------------------
    // status — tracks the lifecycle of the transaction.
    //
    //  "pending"   → initiated but not yet confirmed (e.g. withdrawal requested)
    //  "completed" → settled and final
    //  "failed"    → attempted but reversed (e.g. bank rejection)
    //
    // Most credits arrive as "completed" immediately. Withdrawals start as
    // "pending" until the payment gateway confirms settlement.
    // -------------------------------------------------------------------------
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "completed",
    },

    // -------------------------------------------------------------------------
    // reference — an optional external ID from a payment gateway (e.g. Paystack
    // transaction reference). Stored here so we can reconcile our records with
    // the gateway dashboard. Sparse index: only indexed when the field exists,
    // saving space for the many internal transactions that have no gateway ref.
    // -------------------------------------------------------------------------
    reference: {
      type: String,
      sparse: true,
      index: true,
    },

    // -------------------------------------------------------------------------
    // relatedContract — optionally links this transaction to a contract document.
    // Useful for tracing "why did I receive this payment?" back to a job.
    // -------------------------------------------------------------------------
    relatedContract: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contract",
      default: null,
    },

    // -------------------------------------------------------------------------
    // bankDetails — snapshot of the withdrawal destination at the time of the
    // request. We snapshot rather than reference the User's current bank details
    // because users can update their bank info later; we want the history to
    // reflect what was actually used for each withdrawal.
    // Only populated on "debit" (withdrawal) transactions.
    // -------------------------------------------------------------------------
    bankDetails: {
      bankName: { type: String, default: null },
      accountNumber: { type: String, default: null },
      accountName: { type: String, default: null },
    },
  },
  {
    // -------------------------------------------------------------------------
    // timestamps: true — Mongoose automatically adds `createdAt` and `updatedAt`.
    // `createdAt` is especially important here; it's what we display as the
    // transaction date in the UI and sort by in the history feed.
    // -------------------------------------------------------------------------
    timestamps: true,
  }
);

// =============================================================================
// STATIC METHOD: getWalletSummary(userId)
// -----------------------------------------------------------------------------
// Aggregates all COMPLETED transactions for a user to compute:
//   - availableBalance : what they can spend or withdraw RIGHT NOW
//   - escrowBalance    : funds locked in active contracts (not yet withdrawable)
//   - totalEarned      : lifetime credits (for a "total earned" dashboard stat)
//
// WHY aggregation instead of a stored balance field?
// A stored balance field must be kept in sync with every transaction write.
// Under concurrent requests, that requires transactions/atomic operations.
// By computing on-the-fly from the immutable transaction log, we trade a bit
// of read performance for guaranteed correctness. For a student marketplace
// with moderate traffic this is the right tradeoff. If performance becomes an
// issue, add a Redis cache layer — not a mutable DB field.
// =============================================================================
TransactionSchema.statics.getWalletSummary = async function (userId) {
  const result = await this.aggregate([
    {
      // Step 1: Only look at this user's completed transactions.
      // Excluding "pending" means a pending withdrawal doesn't yet reduce
      // the displayed available balance — it will once it settles.
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        status: "completed",
      },
    },
    {
      // Step 2: Group all matching docs into a single summary object.
      // $cond lets us conditionally add to different accumulators based on
      // the transaction type. Think of it as a SQL CASE WHEN inside SUM().
      $group: {
        _id: null, // null = collapse all docs into one group

        // Credits add to available balance
        totalCredits: {
          $sum: {
            $cond: [{ $eq: ["$type", "credit"] }, "$amount", 0],
          },
        },
        // Debits (withdrawals) subtract from available balance
        totalDebits: {
          $sum: {
            $cond: [{ $eq: ["$type", "debit"] }, "$amount", 0],
          },
        },
        // escrow_in locks money (reduces available)
        totalEscrowIn: {
          $sum: {
            $cond: [{ $eq: ["$type", "escrow_in"] }, "$amount", 0],
          },
        },
        // escrow_out releases money back to available
        totalEscrowOut: {
          $sum: {
            $cond: [{ $eq: ["$type", "escrow_out"] }, "$amount", 0],
          },
        },
      },
    },
    {
      // Step 3: Compute the derived balances from the raw accumulators.
      $project: {
        _id: 0,
        // Available = everything received minus everything sent out minus
        // what's currently locked in escrow
        availableBalance: {
          $subtract: [
            { $add: ["$totalCredits", "$totalEscrowOut"] },
            { $add: ["$totalDebits", "$totalEscrowIn"] },
          ],
        },
        // Escrow = money locked but not yet released
        escrowBalance: {
          $subtract: ["$totalEscrowIn", "$totalEscrowOut"],
        },
        // Lifetime earnings stat (only inbound credits)
        totalEarned: "$totalCredits",
      },
    },
  ]);

  // If the user has zero transactions, the aggregation returns an empty array.
  // Return a safe default object so callers don't need to null-check.
  return result[0] || { availableBalance: 0, escrowBalance: 0, totalEarned: 0 };
};

module.exports = mongoose.model("Transaction", TransactionSchema);
