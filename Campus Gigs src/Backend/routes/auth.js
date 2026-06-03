const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendOTP } = require('../utils/emailHelper');

router.post('/register', async (req, res) => {
    try {
        const { email, studentId, password } = req.body;

        const existingUser = await User.findOne({ $or: [{ email }, { studentId }] });
        if (existingUser) {
            const match = existingUser.email === email ? "email" : "Student ID";
            return res.status(400).json({ message: `This ${match} is already registered.` });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const verificationOtp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        const newUser = new User({
            email,
            studentId,
            password: hashedPassword,
            isVerified: false,
            otp: verificationOtp,
            otpExpires
        });

        await newUser.save();

        try {
            await sendOTP(email, verificationOtp, 'verification');
        } catch (emailErr) {
            console.error('[AUTH] Email send failed:', emailErr.message);
        }

        res.status(201).json({ message: "Registration successful. Check your email for the verification code.", email: newUser.email });

    } catch (err) {
        console.error("Register Error:", err);
        res.status(500).json({ message: "Server error during registration" });
    }
});

router.post('/verify-email', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ email });

        if (!user) return res.status(404).json({ message: "User not found." });
        if (user.isVerified) return res.json({ message: "Email already verified." });
        if (user.otp !== otp) return res.status(400).json({ message: "Invalid verification code." });
        if (user.otpExpires < Date.now()) return res.status(400).json({ message: "Verification code expired. Please request a new one." });

        user.isVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        res.json({ message: "Email verified successfully. You can now log in." });
    } catch (err) {
        res.status(500).json({ message: "Server error during verification." });
    }
});

router.post('/resend-otp', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) return res.status(404).json({ message: "User not found." });
        if (user.isVerified) return res.status(400).json({ message: "Email already verified." });

        const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = newOtp;
        user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();

        await sendOTP(email, newOtp, 'verification');
        res.json({ message: "New verification code sent." });
    } catch (err) {
        res.status(500).json({ message: "Server error." });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) return res.status(400).json({ message: "Invalid credentials" });

        if (!user.isVerified) {
            return res.status(403).json({
                message: "Please verify your email before logging in.",
                needsVerification: true,
                email: user.email
            });
        }

        const normalizeEmail = (emailStr) => (emailStr || '').trim().toLowerCase();
        const normalized = normalizeEmail(email);
        const computedRole = (() => {
            if (normalized === 'abdurrahmanabubakar234@gmail.com') return 'admin';
            if (normalized.endsWith('@nileuniversity.edu.ng')) return 'freelancer';
            return 'client';
        })();

        if (user.role !== computedRole) {
            user.role = computedRole;
            await user.save();
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'secretKey',
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: {
                id: user._id,
                email: user.email,
                onboardingComplete: user.onboardingComplete || false,
                role: user.role || computedRole
            }
        });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ message: "Login error" });
    }
});

router.post('/complete-onboarding', async (req, res) => {
    try {
        const { email, onboardingData } = req.body;
        const user = await User.findOne({ email });

        if (!user) return res.status(404).json({ message: "User not found" });

        if (onboardingData) {
            const { personal, academic, services, profile } = onboardingData;
            if (personal) {
                user.firstName = personal.firstName;
                user.lastName = personal.lastName;
                user.displayName = personal.displayName;
                user.shortBio = personal.shortBio;
                user.avatar = personal.avatar;
            }
            if (academic) {
                user.department = academic.department;
                user.yearOfStudy = academic.yearOfStudy;
                user.graduationYear = academic.graduationYear;
            }
            if (services) user.services = services;
            if (profile) {
                user.skillProficiency = profile.skillProficiency;
                user.availability = profile.availability;
                user.workType = profile.workType;
                user.hourlyRate = profile.hourlyRate;
                user.linkedin = profile.linkedin;
                user.github = profile.github;
                user.resumeName = profile.resume;
            }
        }

        user.onboardingComplete = true;
        await user.save();
        res.json({ message: "Profile completed successfully!" });

    } catch (err) {
        console.error("Onboarding Error:", err);
        res.status(500).json({ message: "Error saving profile data" });
    }
});

router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) return res.status(404).json({ message: "Email not found" });

        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.resetPasswordOtp = resetCode;
        user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();

        try {
            await sendOTP(email, resetCode, 'reset');
        } catch (emailErr) {
            console.error('[AUTH] Reset email failed:', emailErr.message);
        }

        res.json({ message: "Reset code sent to email" });
    } catch (err) {
        res.status(500).json({ message: "Error" });
    }
});

router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ email });

        if (!user) return res.status(404).json({ message: "User not found" });
        if (user.resetPasswordOtp !== otp) return res.status(400).json({ message: "Invalid reset code" });
        if (user.resetPasswordExpires < Date.now()) return res.status(400).json({ message: "Code expired" });

        res.json({ message: "Code verified. You can now reset your password." });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

router.post('/reset-password', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) return res.status(404).json({ message: "User not found" });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        user.resetPasswordOtp = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();
        res.json({ message: "Password updated successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
});

module.exports = router;
