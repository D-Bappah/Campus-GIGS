require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// 1. Middleware
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors());

app.use(express.static('SIgn up.html'));

// 2. Import Routes
const authRoutes = require('./routes/auth');
const gigsRouter = require('./routes/gigs');

// 3. Use Routes
app.use('/api/auth', authRoutes);
app.use('/api/gigs', gigsRouter);

// 4. Database Connection & Server Start
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("✅ MongoDB Connected");
        app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
    })
    .catch(err => console.log("❌ MongoDB Error:", err));