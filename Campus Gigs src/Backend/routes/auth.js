const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 1. REGISTER (Updated with OTP)
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

        // OTP LOGIC STARTS HERE
        const verificationOtp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes from now

        const newUser = new User({
            email,
            studentId,
            password: hashedPassword,
            isVerified: false,
            otp: verificationOtp,       // Save the code here
            otpExpires: otpExpires      // Save the expiration time
        });

        await newUser.save();

        // DEV LOG:Haven't set up Nodemailer yet, see the code in your console!
        console.log(`[AUTH] Verification Code for ${email}: ${verificationOtp}`);

        res.status(201).json({ message: "Registration successful. Please verify your email.", email: newUser.email });

    } catch (err) {
        console.error("Register Error:", err);
        res.status(500).json({ message: "Server error during registration" });
    }
});

// 2. LOGIN
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) return res.status(400).json({ message: "Invalid credentials" });

        // ---------------------------------------------------------------------
        // ROLE RULES (driven purely by the email address)
        // - Admin: only abdurrahmanabubakar234@gmail.com
        // - Freelancer: @nileuniverity.edu.ng
        // - Client: any other domain
        // ---------------------------------------------------------------------
        const normalizeEmail = (emailStr) => (emailStr || '').trim().toLowerCase();
        const normalized = normalizeEmail(email);
        const computedRole = (() => {
            if (normalized === 'abdurrahmanabubakar234@gmail.com') return 'admin';
            if (normalized.endsWith('@nileuniverity.edu.ng')) return 'freelancer';
            if (normalized.endsWith('@gmail.com')) return 'client';
        })();

        // Persist role so it stays consistent across sessions.
        if (user.role !== computedRole) {
            user.role = computedRole;
            await user.save();
        }


        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

        const token = jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET || 'secretKey',
            { expiresIn: '2h' }
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

// 3. COMPLETE ONBOARDING
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

        // Set the completion flag
        user.onboardingComplete = true; 

        // Save everything ONCE and send ONE response
        await user.save();
        res.json({ message: "Profile completed successfully!" });

    } catch (err) {
        console.error("Onboarding Error:", err);
        res.status(500).json({ message: "Error saving profile data" });
    }
});

// 5. FORGOT PASSWORD (Reset Flow)
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) return res.status(404).json({ message: "Email not found" });

        // Generate 6-digit Reset OTP
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

        user.resetPasswordOtp = resetCode; // <--- SAVING TO DB
        user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
        await user.save();

        console.log(`[RESET] OTP for ${email}: ${resetCode}`);

        res.json({ message: "Reset code sent to email" });
    } catch (err) {
        res.status(500).json({ message: "Error" });
    }
});
// 6. VERIFY PASSWORD RESET OTP
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

// 7. ACTUAL PASSWORD RESET
router.post('/reset-password', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) return res.status(404).json({ message: "User not found" });

        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        // Clear the reset OTPs so they can't be reused
        user.resetPasswordOtp = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();
        res.json({ message: "Password updated successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
});
module.exports = router;