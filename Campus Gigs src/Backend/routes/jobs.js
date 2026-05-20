const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Job = require("../models/Job");
const Application = require("../models/Application");
const Contract = require("../models/Contract");
const authMiddleware = require("../middleware/authMiddleware");
const notify = require("../utils/notificationHelper");
const upload = require('../utils/upload');

// =============================================================================
// YOUR EXISTING ROUTES (Kept Safe!)
// =============================================================================

// @route   GET /api/jobs (Browse Feed with Pagination & Filters)
router.get('/', async (req, res) => {
    try {
        const query = {};

        if (req.query.experienceLevel) query.experienceLevel = req.query.experienceLevel;
        if (req.query.location) query.location = req.query.location;
        // Added Claude's new category filter support
        if (req.query.category) query.category = req.query.category; 

        // Text search for job title/description/skills
        if (req.query.searchText) {
            const searchText = String(req.query.searchText).trim();
            if (searchText.length) {
                query.$text = { $search: searchText };
            }
        }

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

// @route   POST /api/jobs (Create a job posting)
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { title, description, category, skills, budget, deliveryDays, location } = req.body;
        
        // 1. Convert budget from Naira to Kobo (MongoDB expects numbers)
        const budgetInKobo = Math.round(parseFloat(budget) * 100);

        // 2. Convert the skills string "Figma, UI/UX" into a proper Array ["Figma", "UI/UX"]
        let skillsArray = skills;
        if (typeof skills === 'string') {
            skillsArray = skills.split(',').map(skill => skill.trim()).filter(Boolean);
        }

        // 3. Build the Job Object
        const newJob = new Job({
            title: title, 
            description: description, 
            category: category, 
            skills: skillsArray,
            budget: budgetInKobo, 
            deliveryDays: deliveryDays, 
            location: location || "Remote",
            postedBy: req.user.id, // <-- CRUCIAL: This assigns the job to the logged-in client!
            status: 'open'
        });

        // 4. Save to Database
        const job = await newJob.save();
        
        // 5. Send back proper JSON
        res.status(201).json({ message: "Job posted successfully!", job });
        
    } catch (err) {
        // Log the exact error in your VS Code terminal so we can see what went wrong
        console.error("🚨 JOB CREATION ERROR:", err.message); 
        
        // Send a proper JSON error back to the frontend so it doesn't crash on 'S'
        res.status(500).json({ message: err.message || "Server error posting job." });
    }
});

// =============================================================================
// =============================================================================

// @route   GET /api/jobs/:id
// @desc    Get single job by ID
router.get('/:id', async (req, res) => {
    try {
        // Use .populate() to magically swap the raw User ID with their actual profile data!
        const job = await Job.findById(req.params.id)
            .populate('postedBy', 'name university avatarUrl'); 
            
        if (!job) {
            return res.status(404).json({ message: "Job not found." });
        }
        
        res.json(job);
    } catch (err) {
        console.error("Error fetching job details:", err);
        res.status(500).json({ message: "Server error fetching job." });
    }
});

router.post("/:id/apply", authMiddleware, upload.single('attachment'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid ID." });
    const job = await Job.findById(req.params.id).lean();
    if (!job) return res.status(404).json({ message: "Job not found." });
    if (job.postedBy.toString() === req.user.id) return res.status(403).json({ message: "Cannot apply to your own job." });
    if (job.status !== "open") return res.status(400).json({ message: "Job is closed." });

    // Multer allows us to read the text fields from req.body again!
    const { coverLetter, bidAmount, deliveryDays } = req.body;
    const bidAmountInKobo = Math.round(parseFloat(bidAmount) * 100);

    // Grab the Cloudinary URL if a file was uploaded
    const attachmentUrl = req.file ? req.file.path : null;

    const application = await Application.create({
      job: req.params.id,
      applicant: req.user.id,
      coverLetter,
      bidAmount: bidAmountInKobo,
      deliveryDays,
      attachmentUrl // Save the file URL
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