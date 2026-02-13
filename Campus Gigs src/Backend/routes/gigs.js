// routes/gigs.js
const express = require('express');
const router = express.Router();
const Gig = require('../models/Gig');

// 1. GET ALL GIGS (Read)
router.get('/', async (req, res) => {
    try {
        const gigs = await Gig.find(); // Fetch all gigs from DB
        res.json(gigs); // Send them back to frontend
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 2. CREATE A NEW GIG (Create)
router.post('/', async (req, res) => {
    const gig = new Gig({
        title: req.body.title,
        description: req.body.description,
        pay: req.body.pay,
        location: req.body.location
    });

    try {
        const newGig = await gig.save(); // Save to DB
        res.status(201).json(newGig);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;