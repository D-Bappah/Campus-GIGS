const express = require('express');
const router = express.Router();
const Job = require('../models/Jobs');

// @route   GET /api/jobs
// @desc    Get all jobs with Filtering and Pagination
// @access  Public
router.get('/', async (req, res) => {
    console.log("🚨 THE NEW ROUTE IS ACTUALLY RUNNING!");
    try {
        const query = {};

        if (req.query.experienceLevel) {
            query.experienceLevel = req.query.experienceLevel;
        }
        if (req.query.location) {
            query.location = req.query.location;
        }

        const page = parseInt(req.query.page) || 1; 
        const limit = parseInt(req.query.limit) || 5; 
        const skip = (page - 1) * limit; 

        const jobs = await Job.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalJobs = await Job.countDocuments(query);

        // Sending the rich object!
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

// @route   POST /api/jobs
// @desc    Create a new job (Temporary open route for testing)
// @access  Public
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

module.exports = router;