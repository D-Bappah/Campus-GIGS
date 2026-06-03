const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    studentId: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    role: { type: String, enum: ['admin', 'freelancer', 'client'], default: 'client' },

    otp: { type: String },
    otpExpires: { type: Date },
    isVerified: { type: Boolean, default: false },

    resetPasswordOtp: { type: String },
    resetPasswordExpires: { type: Date },

    firstName: String,
    lastName: String,
    displayName: String,
    shortBio: String,
    avatar: String,

    department: String,
    yearOfStudy: String,
    graduationYear: String,

    services: [String],

    skillProficiency: String,
    availability: String,
    workType: String,
    hourlyRate: String,
    linkedin: String,
    github: String,
    resumeName: String,

    onboardingComplete: { type: Boolean, default: false },

    githubId: { type: String, default: null },
    githubUsername: { type: String, default: null },
    githubConnected: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
