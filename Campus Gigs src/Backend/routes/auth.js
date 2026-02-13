const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// --- 1. REGISTER ---
router.post('/register', async (req, res) => {
    try {
        const { email, studentId, password } = req.body;

        // Check if user already exists (Check both Email and Student ID)
        const existingUser = await User.findOne({ $or: [{ email }, { studentId }] });
        if (existingUser) {
            const match = existingUser.email === email ? "email" : "Student ID";
            return res.status(400).json({ message: `This ${match} is already registered.` });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            email,
            studentId,
            password: hashedPassword,
            isVerified: false
        });

        await newUser.save();
        res.status(201).json({ message: "Registration successful", email: newUser.email });

    } catch (err) {
        console.error("Register Error:", err);
        res.status(500).json({ message: "Server error during registration" });
    }
});

// --- 2. LOGIN ---
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        
        if (!user) return res.status(400).json({ message: "Invalid credentials" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

        const token = jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET || 'secretKey',
            { expiresIn: '2h' }
        );

        res.json({ token, user: { email: user.email, id: user._id } });
    } catch (err) {
        res.status(500).json({ message: "Login error" });
    }
});

// --- 3. COMPLETE ONBOARDING (The "Huge" Part) ---
router.post('/complete-onboarding', async (req, res) => {
    try {
        const { email, onboardingData } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        // Safely extract data from the frontend storage object
        const { personal, academic, services, profile } = onboardingData;

        // Personal Info
        if (personal) {
            user.firstName = personal.firstName;
            user.lastName = personal.lastName;
            user.displayName = personal.displayName;
            user.shortBio = personal.shortBio;
            user.avatar = personal.avatar;
        }

        // Academic Info
        if (academic) {
            user.department = academic.department;
            user.yearOfStudy = academic.yearOfStudy;
            user.graduationYear = academic.graduationYear;
        }

        // Services
        if (services) user.services = services;

        // Profile Details
        if (profile) {
            user.skillProficiency = profile.skillProficiency;
            user.availability = profile.availability;
            user.workType = profile.workType;
            user.hourlyRate = profile.hourlyRate;
            user.linkedin = profile.linkedin;
            user.github = profile.github;
            user.resumeName = profile.resume;
        }

        await user.save();
        res.json({ message: "Onboarding saved successfully!" });

    } catch (err) {
        console.error("Onboarding Error:", err);
        res.status(500).json({ message: "Error saving profile data" });
    }
});

module.exports = router;