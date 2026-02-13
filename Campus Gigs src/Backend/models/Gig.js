// models/Gig.js
const mongoose = require('mongoose');

const GigSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    pay: { type: Number, required: true },
    location: { type: String, default: 'Remote' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Gig', GigSchema);