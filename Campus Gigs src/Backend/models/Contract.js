// =============================================================================
// -----------------------------------------------------------------------------
// A Contract is created when a client accepts a freelancer's application.
// It tracks the lifecycle of the actual work engagement from start to completion.
//
// Lifecycle:
//   active → (freelancer submits work) → pending_review
//   pending_review → (client approves) → completed
//   pending_review → (client disputes) → disputed
//   active OR pending_review → (either party cancels) → cancelled
//
// On "completed": funds are released from escrow to the freelancer's wallet.
// On "cancelled": funds are returned from escrow to the client's wallet.
// =============================================================================

const mongoose = require("mongoose");

const ContractSchema = new mongoose.Schema(
  {
    // The job this contract fulfils
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },

    // The client who posted the job and is paying
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // indexed for "my contracts as client" dashboard queries
    },

    // The freelancer who won the job and is doing the work
    freelancer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // indexed for "my contracts as freelancer" dashboard queries
    },

    // The accepted application that spawned this contract
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true,
    },

    // -------------------------------------------------------------------------
    // agreedAmount — the price the client agreed to pay (from the winning bid).
    // Stored in kobo. This is snapshotted at contract creation — if the
    // freelancer later edits their profile's rate it won't affect this contract.
    // -------------------------------------------------------------------------
    agreedAmount: {
      type: Number,
      required: true,
      min: [100, "Contract value must be at least ₦1."],
    },

    // Deadline agreed upon (derived from job.deliveryDays at contract creation)
    deadline: {
      type: Date,
      required: true,
    },

    // -------------------------------------------------------------------------
    // status — the current stage of the contract.
    // See module-level comment for the allowed transitions.
    // -------------------------------------------------------------------------
    status: {
      type: String,
      enum: ["active", "pending_review", "completed", "disputed", "cancelled"],
      default: "active",
      index: true,
    },

    // -------------------------------------------------------------------------
    // deliverableUrl — link to the completed work submitted by the freelancer.
    //
    // [EXTERNAL ACTION REQUIRED] ─────────────────────────────────────────────
    // File delivery (source files, design exports, etc.) requires cloud storage.
    // Do NOT store deliverable files on the server filesystem.
    //
    // To implement:
    //  1. Reuse the Cloudinary/S3 setup from the resume upload feature.
    //  2. Add a PUT /api/contracts/:id/deliver route with multer middleware.
    //  3. Store the returned URL in this field.
    //  4. The client then reviews the URL before approving or disputing.
    //
    // For text-based deliverables (e.g., copywriting), the freelancer can
    // paste content into a `deliverableNote` text field (add that field below).
    // ─────────────────────────────────────────────────────────────────────────

    
    deliverableUrl: {
      type: String,
      default: null,
    },

    // -------------------------------------------------------------------------
    // deliverableNote — text-based delivery (no file needed).
    // E.g., "I've pushed the code to https://github.com/... See branch 'feature/x'"
    // -------------------------------------------------------------------------
    submissionUrl: { type: String, default: null },
    deliverableNote: {
      type: String,
      default: null,
      maxlength: 1000,
    },

    // -------------------------------------------------------------------------
    // clientSignedAt / freelancerSignedAt — timestamps for e-signature consent.
    //
    // [EXTERNAL ACTION REQUIRED] ─────────────────────────────────────────────
    // True legally-binding e-signatures require a third-party service:
    //  • HelloSign / Dropbox Sign: https://www.hellosign.com
    //  • DocuSign: https://www.docusign.com
    //
    // For a student marketplace, a simpler approach is sufficient:
    //   Store the timestamp of when each party clicked "I Agree" as a record
    //   of consent. This is what the two fields below capture.
    //
    // Full e-signature integration steps:
    //  1. Sign up for HelloSign API (free tier available).
    //  2. Create a signature request template for your contract terms.
    //  3. When a contract is created, call HelloSign API to send each party
    //     a signature request email.
    //  4. HelloSign webhooks notify you when each party signs.
    //  5. Store the signature_request_id in a `signatureRequestId` field.
    // ─────────────────────────────────────────────────────────────────────────
    clientSignedAt: { type: Date, default: null },
    freelancerSignedAt: { type: Date, default: null },

    // Free-text notes added at cancellation or dispute resolution
    resolutionNote: { type: String, default: null },
  },
  { timestamps: true }
);

// =============================================================================
// VIRTUAL: isOverdue
// Returns true if the contract is still active but past the deadline.
// Virtuals are computed on read, not stored — so this is always accurate
// without needing a scheduled job to update a "overdue" field.
// =============================================================================
ContractSchema.virtual("isOverdue").get(function () {
  return (
    this.status === "active" && this.deadline && new Date() > this.deadline
  );
});

// Ensure virtuals are included when converting to JSON (for API responses)
ContractSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Contract", ContractSchema);
