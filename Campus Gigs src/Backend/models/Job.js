const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Job = require("../models/Job");
const Application = require("../models/Application");
const Contract = require("../models/Contract");
const authMiddleware = require("../middleware/authMiddleware");
const notify = require("../utils/notificationHelper");

// @route   GET /api/jobs (Browse Feed with Pagination & Filters)
router.get('/', async (req, res) => {
    try {
        const query = {};

        if (req.query.experienceLevel) query.experienceLevel = req.query.experienceLevel;
        if (req.query.location) query.location = req.query.location;
        // Added new category filter support
        if (req.query.category) query.category = req.query.category; 

        const page = parseInt(req.query.page) || 1; 
        const limit = parseInt(req.query.limit) || 5; 
        const skip = (page - 1) * limit; 

        const jobs = await Job.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalJobs = await Job.countDocuments(query);

        res.json({
            jobs: jobs,
            currentPage: page,
            totalPages: Math.ceil(totalJobs / limit) || 1,
            totalJobs: totalJobs
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/jobs (Dummy Postman Creation)
router.post('/', async (req, res) => {
    try {
        const newJob = new Job(req.body);
        const job = await newJob.save();
        res.json(job);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid job ID." });
    const job = await Job.findById(req.params.id).populate("postedBy", "name avatarUrl university bio").lean();
    if (!job) return res.status(404).json({ message: "Job not found." });
    
    const applicationCount = await Application.countDocuments({ job: job._id });
    res.json({ ...job, applicationCount });
  } catch (err) {
    res.status(500).json({ message: "Server error." });
  }
});

router.post("/:id/apply", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid ID." });
    const job = await Job.findById(req.params.id).lean();
    if (!job) return res.status(404).json({ message: "Job not found." });
    if (job.postedBy.toString() === req.user.id) return res.status(403).json({ message: "Cannot apply to your own job." });
    if (job.status !== "open") return res.status(400).json({ message: "Job is closed." });

    const { coverLetter, bidAmount, deliveryDays } = req.body;
    const bidAmountInKobo = Math.round(parseFloat(bidAmount) * 100);

    const application = await Application.create({
      job: req.params.id,
      applicant: req.user.id,
      coverLetter,
      bidAmount: bidAmountInKobo,
      deliveryDays,
    });

    await application.populate("applicant", "name avatarUrl university");
    notify.newApplication(job.postedBy, job, application);

    res.status(201).json({ message: "Application submitted!", application });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "Already applied." });
    res.status(500).json({ message: "Server error." });
  }
});

router.get("/:id/applications", authMiddleware, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).lean();
    if (!job) return res.status(404).json({ message: "Job not found." });
    if (job.postedBy.toString() !== req.user.id) return res.status(403).json({ message: "Access denied." });

    const applications = await Application.find({ job: req.params.id })
      .populate("applicant", "name avatarUrl university rating completedJobs")
      .sort({ createdAt: -1 }).lean();

    res.json({ applications, total: applications.length });
  } catch (err) {
    res.status(500).json({ message: "Server error." });
  }
});

router.put("/:id/applications/:appId", authMiddleware, async (req, res) => {
  const { status } = req.body;
  if (!["accepted", "rejected"].includes(status)) return res.status(400).json({ message: 'Invalid status.' });

  try {
    const job = await Job.findById(req.params.id);
    if (job.postedBy.toString() !== req.user.id) return res.status(403).json({ message: "Access denied." });

    const application = await Application.findOne({ _id: req.params.appId, job: req.params.id });
    if (!application) return res.status(404).json({ message: "Application not found." });

    application.status = status;
    await application.save();

    if (status === "accepted") {
      await Application.updateMany(
        { job: req.params.id, _id: { $ne: req.params.appId }, status: "pending" },
        { status: "rejected" }
      );
      job.status = "in_progress";
      job.assignedTo = application.applicant;
      await job.save();

      const deadline = new Date();
      deadline.setDate(deadline.getDate() + application.deliveryDays);

      const contract = await Contract.create({
        job: job._id, application: application._id, client: req.user.id,
        freelancer: application.applicant, agreedAmount: application.bidAmount, deadline,
      });

      notify.applicationAccepted(application.applicant, job, contract);
      notify.contractCreated(req.user.id, application.applicant, contract, job);
    } else {
      notify.applicationRejected(application.applicant, job);
    }

    res.json({ message: `Application ${status}.`, application });
  } catch (err) {
    res.status(500).json({ message: "Server error." });
  }
});

module.exports = router;