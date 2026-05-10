const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    priceRange: { type: String, required: true }, // e.g., "$25 - $50" or "N15,000"
    experienceLevel: { type: String, required: true }, // e.g., "Beginner", "Intermediate"
    duration: { type: String, required: true }, // e.g., "3 weeks"
    location: { type: String, required: true }, // e.g., "Remote", "On Campus"
    tags: { type: [String], default: [] }, // Array of strings like ['UI/UX', 'Figma']
    postedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', // Links the job to the client who created it
        required: false // Optional for now while we test
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Job', JobSchema);