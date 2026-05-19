// =============================================================================
// models/Application.js
// -----------------------------------------------------------------------------
// Represents a freelancer's proposal/bid on a job posting.
// One Application document = one freelancer bidding on one job.
// A single job can have many Applications (one-to-many from Job → Applications).
//
// Lifecycle: pending → accepted OR rejected
// When an Application is accepted, a Contract document should be created
// (see Contract.js) and all other Applications for that job set to "rejected".
// =============================================================================

const mongoose = require("mongoose");

const ApplicationSchema = new mongoose.Schema(
  {
    // -------------------------------------------------------------------------
    // job — which job posting this application is for.
    // Compound index with `applicant` enforces one-application-per-user-per-job
    // at the database level (see index definition at the bottom).
    // -------------------------------------------------------------------------
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },

    // -------------------------------------------------------------------------
    // applicant — the freelancer submitting the proposal.
    // -------------------------------------------------------------------------
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // -------------------------------------------------------------------------
    // coverLetter — the freelancer's pitch explaining why they're a good fit.
    // Required because a blank application gives the client nothing to evaluate.
    // -------------------------------------------------------------------------
    coverLetter: {
      type: String,
      required: [true, "A cover letter is required."],
      trim: true,
      minlength: [50, "Cover letter must be at least 50 characters."],
      maxlength: [2000, "Cover letter cannot exceed 2000 characters."],
    },

    // -------------------------------------------------------------------------
    // bidAmount — the freelancer's proposed price for the job (in kobo).
    // The client posted a budget; the freelancer can bid higher or lower.
    // -------------------------------------------------------------------------
    bidAmount: {
      type: Number,
      required: [true, "A bid amount is required."],
      min: [100, "Bid amount must be at least ₦1."],
    },

    // -------------------------------------------------------------------------
    // deliveryDays — the freelancer's proposed turnaround time in days.
    // -------------------------------------------------------------------------
    deliveryDays: {
      type: Number,
      required: [true, "Estimated delivery days is required."],
      min: [1, "Delivery time must be at least 1 day."],
    },

    // -------------------------------------------------------------------------
    // status — the client's decision on this application.
    // "pending"  → awaiting client review (default)
    // "accepted" → client chose this freelancer; triggers contract creation
    // "rejected" → client passed on this applicant
    // -------------------------------------------------------------------------
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },

    // -------------------------------------------------------------------------
    // resumeUrl — link to the applicant's uploaded resume/portfolio PDF.
    //
    // [EXTERNAL ACTION REQUIRED] ─────────────────────────────────────────────
    // File upload requires cloud storage. Do NOT store files on the server
    // filesystem — it doesn't persist across deploys and doesn't scale.
    //
    // To implement resume uploads:
    //  1. Sign up for Cloudinary (free tier: https://cloudinary.com) or AWS S3.
    //  2. npm install multer multer-storage-cloudinary cloudinary
    //  3. Configure a Cloudinary upload preset or S3 bucket with appropriate
    //     CORS rules and public-read access for resumes.
    //  4. In the route that handles application submission, add a multer
    //     middleware that intercepts the multipart/form-data request, streams
    //     the file to Cloudinary/S3, and puts the returned URL in req.file.path.
    //  5. Store that URL in this `resumeUrl` field.
    //
    // For now, this field is optional — text-only applications are allowed.
    // ─────────────────────────────────────────────────────────────────────────
    attachmentUrl: { type: String, default: null },
    
    resumeUrl: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// =============================================================================
// COMPOUND UNIQUE INDEX
// -----------------------------------------------------------------------------
// Prevents a freelancer from submitting more than one application to the same
// job. Enforced at the database level so it's impossible to bypass via direct
// Mongoose calls. The route-level check is a second layer for friendlier errors.
// =============================================================================
ApplicationSchema.index({ job: 1, applicant: 1 }, { unique: true });

module.exports = mongoose.model("Application", ApplicationSchema);
