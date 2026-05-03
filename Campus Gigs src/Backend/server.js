require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

//
// Define exactly who is allowed to talk to your API
const allowedOrigins = [
    'http://127.0.0.1:5500',           // Standard Live Server IP
    'http://localhost:5500',           // Standard Live Server Localhost
    'http://127.0.0.1:5501',           // Fallback Live Server IP
    'http://localhost:5501',           // Fallback Live Server Localhost
    'https://campusgigs-nile.com',     // Future Production Domain
    'https://www.campusgigs-nile.com'  // Future Production Domain (www)
];

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        // OR allow if the origin is in our whitelist
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS restrictions'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Restrict allowed HTTP methods
    credentials: true // Crucial if you ever switch from localStorage JWTs to HttpOnly Cookies
};

// 1. Middleware
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors(corsOptions));

app.use(express.static('SIgn up.html'));

// 2. Import Routes
const authRoutes = require('./routes/auth');
const gigsRouter = require('./routes/gigs');
app.use('/api/users', require('./routes/users'));

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
