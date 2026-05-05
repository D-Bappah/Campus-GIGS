const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    // Auth Fields
    email: { type: String, required: true, unique: true },
    studentId: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    otp: { type: String },
    otpExpires: { type: Date },
    isVerified: { type: Boolean, default: false },

    // Personal Info
    firstName: String,
    lastName: String,
    displayName: String,
    shortBio: String,
    avatar: String, // Stores the image as a long string

    // Academic Info
    department: String,
    yearOfStudy: String,
    graduationYear: String,

    // Services
    services: [String], // Array of services (e.g., ["Research", "Events"])

    // Profile Setup
    skillProficiency: String,
    availability: String,
    workType: String,
    hourlyRate: String,
    linkedin: String,
    github: String,
    resumeName: String,

    onboardingComplete: { type: Boolean, default: false },
// For New User Registration
    otp: { type: String },
    otpExpires: { type: Date },

    // For Password Reset
    resetPasswordOtp: { type: String },
    resetPasswordExpires: { type: Date },
    
    isVerified: { type: Boolean, default: false },

    githubId: {
        type: String,
        default: null
    },
    githubUsername: {
        type: String,
        default: null
    },
    githubConnected: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model('User', UserSchema);