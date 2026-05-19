// =============================================================================
// routes/contracts.js
// -----------------------------------------------------------------------------
// All contract lifecycle endpoints.
// Base path (registered in server.js): /api/contracts
//
// All routes are protected by authMiddleware.
// =============================================================================

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Contract = require("../models/Contract");
const Transaction = require("../models/Transaction");
const Job = require("../models/Job");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require('../utils/upload');

router.use(authMiddleware);

// =============================================================================
// GET /api/contracts
// -----------------------------------------------------------------------------
// Returns all contracts where the authenticated user is either the client
// OR the freelancer. Supports filtering by status via query param.
//
// Query params:
//   status (optional) — filter by contract status ("active", "completed", etc.)
//   role   (optional) — "client" or "freelancer" to filter by the user's role
//
// This is the data source for work.html.
// =============================================================================
router.get("/", async (req, res) => {
  try {
    const { status, role } = req.query;
    const userId = req.user.id;

    // -------------------------------------------------------------------------
    // Build the query filter dynamically.
    // The $or clause finds contracts where this user plays EITHER role.
    // We then optionally narrow by status and/or role.
    // -------------------------------------------------------------------------
    let filter = {};

    if (role === "client") {
      filter.client = userId;
    } else if (role === "freelancer") {
      filter.freelancer = userId;
    } else {
      // Default: return contracts in either role
      filter.$or = [{ client: userId }, { freelancer: userId }];
    }

    // Add status filter if provided and valid
    const validStatuses = ["active", "pending_review", "completed", "disputed", "cancelled"];
    if (status && validStatuses.includes(status)) {
      filter.status = status;
    }

    const contracts = await Contract.find(filter)
      .populate("job", "title category") // just enough to render a contract card
      .populate("client", "name avatarUrl")
      .populate("freelancer", "name avatarUrl")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ contracts, total: contracts.length });
  } catch (err) {
    console.error("GET /api/contracts error:", err);
    res.status(500).json({ message: "Server error fetching contracts." });
  }
});

// =============================================================================
// GET /api/contracts/:id
// -----------------------------------------------------------------------------
// Returns a single contract by ID with full population.
// Only accessible to the client or freelancer named in the contract.
// This is the data source for contract-details.html.
// =============================================================================
// @route   POST /api/contracts/:id/submit
router.post('/:id/submit', authMiddleware, upload.single('workFile'), async (req, res) => {
    try {
        const { deliverableNote } = req.body;
        const submissionUrl = req.file ? req.file.path : null;

        const contract = await Contract.findOneAndUpdate(
            { _id: req.params.id, freelancer: req.user.id },
            { 
                status: 'pending_review', 
                submissionUrl, 
                deliverableNote 
            },
            { new: true }
        );

        if (!contract) return res.status(404).json({ message: "Contract not found." });

        res.json({ message: "Work submitted successfully!", contract });
    } catch (err) {
        res.status(500).json({ message: "Server error." });
    }
});

router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid contract ID." });
    }

    const contract = await Contract.findById(req.params.id)
      .populate("job", "title description category skills")
      .populate("client", "name avatarUrl university email")
      .populate("freelancer", "name avatarUrl university email")
      .populate("application", "coverLetter bidAmount deliveryDays")
      .lean({ virtuals: true }); // include `isOverdue` virtual in the response

    if (!contract) {
      return res.status(404).json({ message: "Contract not found." });
    }

    // Security: only the two parties named in the contract may view it
    const userId = req.user.id;
    const isParty =
      contract.client._id.toString() === userId ||
      contract.freelancer._id.toString() === userId;

    if (!isParty) {
      return res.status(403).json({ message: "Access denied." });
    }

    res.json(contract);
  } catch (err) {
    console.error("GET /api/contracts/:id error:", err);
    res.status(500).json({ message: "Server error fetching contract." });
  }
});

// =============================================================================
// PUT /api/contracts/:id/status
// -----------------------------------------------------------------------------
// Updates the contract status. Different status transitions are permitted
// for different roles:
//
//   Freelancer can:   active → pending_review  (submitting deliverable)
//   Client can:       pending_review → completed  (approving delivery)
//                     pending_review → disputed   (raising a dispute)
//   Either can:       active → cancelled          (mutual cancellation flow)
//
// When status becomes "completed", this route:
//   1. Updates the contract status
//   2. Releases escrow funds as a credit to the freelancer's wallet
//   3. Updates the job status to "completed"
//
// Request body:
// {
//   status: String,
//   deliverableNote: String  (required when transitioning to "pending_review")
//   resolutionNote: String   (optional, for cancellation or dispute)
// }
// =============================================================================
router.put("/:id/status", async (req, res) => {
  const { status, deliverableNote, resolutionNote } = req.body;
  const userId = req.user.id;

  // Validate the requested new status
  const validTransitions = ["pending_review", "completed", "disputed", "cancelled"];
  if (!validTransitions.includes(status)) {
    return res.status(400).json({ message: `Invalid target status: ${status}` });
  }

  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid contract ID." });
    }

    // Load with full party references for role-checking
    const contract = await Contract.findById(req.params.id).populate(
      "client freelancer",
      "_id"
    );

    if (!contract) {
      return res.status(404).json({ message: "Contract not found." });
    }

    const isClient = contract.client._id.toString() === userId;
    const isFreelancer = contract.freelancer._id.toString() === userId;

    if (!isClient && !isFreelancer) {
      return res.status(403).json({ message: "Access denied." });
    }

    // -------------------------------------------------------------------------
    // Enforce role-based transition rules.
    // Using a whitelist approach (only allow what's explicitly permitted)
    // rather than a blacklist (block what's forbidden) — safer default.
    // -------------------------------------------------------------------------
    const currentStatus = contract.status;

    if (status === "pending_review") {
      if (!isFreelancer) {
        return res.status(403).json({
          message: "Only the freelancer can submit work for review.",
        });
      }
      if (currentStatus !== "active") {
        return res.status(400).json({
          message: `Cannot submit for review from status: ${currentStatus}`,
        });
      }
      if (!deliverableNote && !contract.deliverableUrl) {
        return res.status(400).json({
          message: "Please include a deliverable note or upload your files before submitting.",
        });
      }
      contract.deliverableNote = deliverableNote || contract.deliverableNote;
    } else if (status === "completed") {
      if (!isClient) {
        return res.status(403).json({
          message: "Only the client can approve and complete a contract.",
        });
      }
      if (currentStatus !== "pending_review") {
        return res.status(400).json({
          message: `Cannot complete a contract that is in status: ${currentStatus}`,
        });
      }
    } else if (status === "disputed") {
      if (!isClient) {
        return res.status(403).json({
          message: "Only the client can raise a dispute.",
        });
      }
      if (currentStatus !== "pending_review") {
        return res.status(400).json({ message: "Can only dispute a pending review." });
      }
    } else if (status === "cancelled") {
      if (!["active", "pending_review"].includes(currentStatus)) {
        return res.status(400).json({
          message: `Cannot cancel a contract in status: ${currentStatus}`,
        });
      }
    }

    // Apply the status change
    contract.status = status;
    if (resolutionNote) contract.resolutionNote = resolutionNote;

    // -------------------------------------------------------------------------
    // COMPLETION FLOW — Release escrow to freelancer
    // -------------------------------------------------------------------------
    if (status === "completed") {
      // Credit the freelancer's wallet by releasing the escrowed funds.
      // We create an "escrow_out" transaction (which adds to available balance)
      // and a "credit" transaction for their lifetime earnings stat.
      //
      // In a production system with real escrow, you'd also deduct from the
      // client's escrow_in balance. For now we just credit the freelancer.
      await Transaction.create({
        user: contract.freelancer._id,
        type: "escrow_out",
        amount: contract.agreedAmount,
        currency: "NGN",
        description: `Payment released for contract: ${contract._id}`,
        status: "completed",
        relatedContract: contract._id,
      });

      // Also mark the job as completed
      await Job.findByIdAndUpdate(contract.job, { status: "completed" });

    // -------------------------------------------------------------------------
    // CANCELLATION FLOW — Return escrow to client
    // -------------------------------------------------------------------------
    } else if (status === "cancelled") {
      // Refund the client by crediting them the escrowed amount
      await Transaction.create({
        user: contract.client._id,
        type: "credit",
        amount: contract.agreedAmount,
        currency: "NGN",
        description: `Refund for cancelled contract: ${contract._id}`,
        status: "completed",
        relatedContract: contract._id,
      });

      // Reopen the job so the client can re-hire someone else
      await Job.findByIdAndUpdate(contract.job, {
        status: "open",
        assignedTo: null,
      });
    }

    await contract.save();

    res.json({
      message: `Contract status updated to "${status}".`,
      contract,
    });
  } catch (err) {
    console.error("PUT /api/contracts/:id/status error:", err);
    res.status(500).json({ message: "Server error updating contract." });
  }
});

// =============================================================================
// POST /api/contracts (internal use — called when an application is accepted)
// -----------------------------------------------------------------------------
// Creates a new contract document. This is typically called programmatically
// from the PUT /api/jobs/:id/applications/:appId route when status is "accepted",
// not called directly by the frontend.
// =============================================================================
router.post("/", async (req, res) => {
  const { jobId, applicationId, clientId, freelancerId, agreedAmount, deliveryDays } =
    req.body;

  try {
    // Calculate the deadline from today + delivery days
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + parseInt(deliveryDays));

    const contract = await Contract.create({
      job: jobId,
      application: applicationId,
      client: clientId,
      freelancer: freelancerId,
      agreedAmount,
      deadline,
    });

    // Lock the agreed amount in escrow from the client's wallet
    await Transaction.create({
      user: clientId,
      type: "escrow_in",
      amount: agreedAmount,
      currency: "NGN",
      description: `Escrow for contract: ${contract._id}`,
      status: "completed",
      relatedContract: contract._id,
    });

    res.status(201).json(contract);
  } catch (err) {
    console.error("POST /api/contracts error:", err);
    res.status(500).json({ message: "Server error creating contract." });
  }
});

module.exports = router;
