// =============================================================================
// routes/jobs.js  (EXTENDED — add these routes to your existing jobs router)
// -----------------------------------------------------------------------------
// New routes added in this phase:
//   GET  /api/jobs/:id              — fetch a single job with full details
//   POST /api/jobs/:id/apply        — submit a proposal for a job
//   GET  /api/jobs/:id/applications — list all applications for a job (client only)
//   PUT  /api/jobs/:id/applications/:appId — accept/reject an application (client only)
// =============================================================================

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Job = require("../models/Job");
const Application = require("../models/Application");
const authMiddleware = require("../middleware/authMiddleware");

// =============================================================================
// GET /api/jobs/:id
// -----------------------------------------------------------------------------
// Returns a single job posting by its MongoDB ObjectId.
// This is the data source for job-details.html.
//
// Public route — no auth required to VIEW a job. Auth is required to APPLY.
// We populate the `postedBy` field so the frontend can display the client's
// name and avatar without a second request.
// =============================================================================
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid job ID format." });
    }

    const job = await Job.findById(req.params.id)
      // Populate only the fields the UI needs — don't expose the client's
      // full profile (email, bankDetails, etc.) to anonymous viewers.
      .populate("postedBy", "name avatarUrl university bio")
      .lean();

    if (!job) {
      return res.status(404).json({ message: "Job not found." });
    }

    // -------------------------------------------------------------------------
    // Attach the application count so job-details.html can show "12 proposals"
    // without a second request. countDocuments is an indexed count — fast.
    // -------------------------------------------------------------------------
    const applicationCount = await Application.countDocuments({ job: job._id });

    res.json({ ...job, applicationCount });
  } catch (err) {
    console.error("GET /api/jobs/:id error:", err);
    res.status(500).json({ message: "Server error fetching job." });
  }
});

// =============================================================================
// POST /api/jobs/:id/apply
// -----------------------------------------------------------------------------
// Submits a new application/proposal for a job.
// Protected — only authenticated users can apply.
//
// Business rules enforced here:
//  1. Cannot apply to your own job posting
//  2. Cannot apply twice to the same job
//  3. Cannot apply to a closed/completed job
//
// [EXTERNAL ACTION REQUIRED] ─────────────────────────────────────────────────
// Resume file upload requires Cloudinary or AWS S3.
// See Application.js → resumeUrl field for full instructions.
// Until that's configured, this route accepts JSON only (no file).
// When ready, add multer middleware before this handler and read
// req.file.path to get the uploaded URL.
// ─────────────────────────────────────────────────────────────────────────────
//
// Request body (JSON):
// {
//   coverLetter: String,
//   bidAmount: Number,    ← in Naira (frontend), converted to kobo here
//   deliveryDays: Number
// }
// =============================================================================
router.post("/:id/apply", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid job ID format." });
    }

    // -------------------------------------------------------------------------
    // Load the job first so we can enforce business rules before writing
    // anything to the database.
    // -------------------------------------------------------------------------
    const job = await Job.findById(req.params.id).lean();

    if (!job) {
      return res.status(404).json({ message: "Job not found." });
    }

    // Rule 1: Clients cannot bid on their own jobs
    if (job.postedBy.toString() === req.user.id) {
      return res
        .status(403)
        .json({ message: "You cannot apply to your own job posting." });
    }

    // Rule 2: Only apply to open jobs
    if (job.status !== "open") {
      return res.status(400).json({
        message: `This job is no longer accepting applications (status: ${job.status}).`,
      });
    }

    const { coverLetter, bidAmount, deliveryDays } = req.body;

    // -------------------------------------------------------------------------
    // Convert bidAmount from Naira (as entered in the form) to kobo.
    // All monetary values in the database are stored in the smallest currency
    // unit to prevent floating-point rounding errors during calculations.
    // -------------------------------------------------------------------------
    const bidAmountInKobo = Math.round(parseFloat(bidAmount) * 100);

    // -------------------------------------------------------------------------
    // Attempt to create the Application. The compound unique index on
    // { job, applicant } will throw a duplicate key error (code 11000) if
    // this user already applied. We catch that specifically below.
    // -------------------------------------------------------------------------
    const application = await Application.create({
      job: req.params.id,
      applicant: req.user.id,
      coverLetter,
      bidAmount: bidAmountInKobo,
      deliveryDays,
      // resumeUrl: req.file?.path || null,  ← uncomment after Cloudinary setup
    });

    // Populate the applicant field so the response includes their name/avatar
    // (useful if the client-side immediately renders the new application card)
    await application.populate("applicant", "name avatarUrl university");

    res.status(201).json({
      message: "Application submitted successfully!",
      application,
    });
  } catch (err) {
    // -------------------------------------------------------------------------
    // MongoDB error code 11000 = duplicate key — the unique index fired.
    // Return a human-friendly message instead of exposing the raw Mongo error.
    // -------------------------------------------------------------------------
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ message: "You have already applied to this job." });
    }
    console.error("POST /api/jobs/:id/apply error:", err);
    res.status(500).json({ message: "Server error submitting application." });
  }
});

// =============================================================================
// GET /api/jobs/:id/applications
// -----------------------------------------------------------------------------
// Returns all applications for a specific job.
// Restricted to the job's poster (client) only.
// Used by the client's dashboard to review incoming proposals.
// =============================================================================
router.get("/:id/applications", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid job ID format." });
    }

    const job = await Job.findById(req.params.id).lean();
    if (!job) {
      return res.status(404).json({ message: "Job not found." });
    }

    // Ownership check — only the poster can see who applied
    if (job.postedBy.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Access denied. You are not the poster of this job." });
    }

    const applications = await Application.find({ job: req.params.id })
      .populate("applicant", "name avatarUrl university rating completedJobs")
      .sort({ createdAt: -1 }) // most recent applications first
      .lean();

    res.json({ applications, total: applications.length });
  } catch (err) {
    console.error("GET /api/jobs/:id/applications error:", err);
    res.status(500).json({ message: "Server error fetching applications." });
  }
});

// =============================================================================
// PUT /api/jobs/:id/applications/:appId
// -----------------------------------------------------------------------------
// Allows the job poster (client) to accept or reject an application.
//
// When an application is ACCEPTED:
//   1. That application's status → "accepted"
//   2. All OTHER applications for this job → "rejected" (atomically)
//   3. The job's status → "in_progress" (no more applications accepted)
//
// This is a multi-document write, so ideally it runs in a MongoDB session.
// See the comment in wallet.js → /withdraw for notes on sessions + replica sets.
// =============================================================================
router.put("/:id/applications/:appId", authMiddleware, async (req, res) => {
  const { status } = req.body; // expected: "accepted" or "rejected"

  if (!["accepted", "rejected"].includes(status)) {
    return res
      .status(400)
      .json({ message: 'Status must be "accepted" or "rejected".' });
  }

  try {
    // Validate both IDs
    if (
      !mongoose.Types.ObjectId.isValid(req.params.id) ||
      !mongoose.Types.ObjectId.isValid(req.params.appId)
    ) {
      return res.status(400).json({ message: "Invalid ID format." });
    }

    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: "Job not found." });

    // Ownership gate
    if (job.postedBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Access denied." });
    }

    const application = await Application.findOne({
      _id: req.params.appId,
      job: req.params.id,
    });
    if (!application) {
      return res.status(404).json({ message: "Application not found." });
    }

    // Update the target application's status
    application.status = status;
    await application.save();

    // -------------------------------------------------------------------------
    // If accepting: close the job to further applications and reject the rest.
    // Using updateMany here instead of a loop because it's a single round-trip
    // to the database regardless of how many competing applications there are.
    // -------------------------------------------------------------------------
    if (status === "accepted") {
      // Reject all OTHER pending applications for this job atomically
      await Application.updateMany(
        {
          job: req.params.id,
          _id: { $ne: req.params.appId }, // $ne = "not equal" (exclude the accepted one)
          status: "pending",
        },
        { status: "rejected" }
      );

      // Mark the job as in-progress so it stops appearing in the Browse feed
      job.status = "in_progress";
      // Store a reference to the winning applicant for quick lookup later
      job.assignedTo = application.applicant;
      await job.save();

      // -----------------------------------------------------------------------
      // TODO: Create a Contract document here once Contract.js is wired up.
      // See routes/contracts.js for the contract creation logic.
      // -----------------------------------------------------------------------
    }

    res.json({
      message: `Application ${status} successfully.`,
      application,
    });
  } catch (err) {
    console.error("PUT /api/jobs/:id/applications/:appId error:", err);
    res.status(500).json({ message: "Server error updating application." });
  }
});

module.exports = router;
