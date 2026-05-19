require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const passport = require('passport');
require('./config/passport');

const app = express();

// Whitelist strictly locked to local development
const allowedOrigins = [
    'http://127.0.0.1:5500',           
    'http://localhost:5500',           
    'http://127.0.0.1:5501',           
    'http://localhost:5501'          
];

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS restrictions'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true 
};

// 1. Middleware
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors(corsOptions));
app.use(passport.initialize());

// 2. Import & Use Routes
// Your Core Routes:
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/gigs', require('./routes/gigs'));

// The New Advanced Routes:
app.use('/api/contracts', require('./routes/contracts'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/applications', require('./routes/applications'));

// 3. Database Connection & Server Start
// Staying strictly on local port 5000 for stability
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("✅ MongoDB Connected");
        app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
    })
    .catch(err => console.log("❌ MongoDB Error:", err));