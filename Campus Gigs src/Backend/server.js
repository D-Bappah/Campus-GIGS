// =============================================================================
// server.js
// -----------------------------------------------------------------------------
// Main Express application entry point for Campus Gigs backend.
//
// Responsibilities:
//   1. Connect to MongoDB via Mongoose
//   2. Configure global middleware (CORS, JSON parsing, rate limiting)
//   3. Mount all API route modules under /api/...
//   4. Start the HTTP server
//
// Run with: node server.js  OR  nodemon server.js (for development auto-reload)
// =============================================================================

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config(); // Load .env variables into process.env

const app = express();

// =============================================================================
// MIDDLEWARE — Applied globally to every incoming request
// =============================================================================

// -------------------------------------------------------------------------
// CORS — Allow the decoupled frontend (served from a different origin) to
// make fetch() requests to this API.
//
// In development, the frontend is typically opened directly from the file
// system (file://) or via VS Code Live Server (http://127.0.0.1:5500).
// In production, replace the origin array with your actual frontend domain.
//
// credentials: true is required if you ever move to cookie-based auth.
// -------------------------------------------------------------------------
app.use(
  cors({
    origin: [
      "http://127.0.0.1:5500",   // VS Code Live Server default
      "http://localhost:5500",    // alternate Live Server address
      "http://localhost:3000",    // Create React App / Vite dev server (if ever used)
      "http://127.0.0.1:3000",
    ],
    credentials: true,
  })
);

// Parse incoming request bodies as JSON.
// The limit is raised from the default 100kb to 1mb to accommodate base64
// encoded data or large cover letters. Adjust as needed.
app.use(express.json({ limit: "1mb" }));

// Parse URL-encoded form bodies (for any traditional HTML form submissions)
app.use(express.urlencoded({ extended: true }));

// -------------------------------------------------------------------------
// Request logger — logs every incoming request to the console in development.
// Remove or replace with a proper logger (e.g. morgan, winston) in production.
// -------------------------------------------------------------------------
if (process.env.NODE_ENV !== "production") {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// =============================================================================
// DATABASE CONNECTION
// -----------------------------------------------------------------------------
// We connect to MongoDB before starting the HTTP server. If the connection
// fails, we log the error and exit — there's no point serving routes when
// the database is unavailable.
//
// The MONGODB_URI in .env should look like:
//   mongodb://localhost:27017/campus_gigs           (local)
//   mongodb+srv://user:pass@cluster.mongodb.net/db  (Atlas)
// =============================================================================
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      // These options suppress Mongoose deprecation warnings in older versions.
      // They are the defaults in Mongoose 6+ so you can remove them if on v6+.
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB connected successfully.");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    // Exit the process — a crashed server is better than a server silently
    // failing to persist data. Your process manager (PM2, Docker) will restart it.
    process.exit(1);
  }
};

// =============================================================================
// ROUTE MODULES
// -----------------------------------------------------------------------------
// Each feature area has its own router file. Mounting them here under /api/
// keeps all routes consistent and easy to proxy behind an Nginx/load balancer.
// =============================================================================

// Previously completed routes (already in your project)
const authRoutes    = require("./routes/auth");
const userRoutes    = require("./routes/users");

// New routes built in this phase
const jobRoutes         = require("./routes/jobs");
const walletRoutes      = require("./routes/wallet");
const contractRoutes    = require("./routes/contracts");
const messageRoutes     = require("./routes/messages");
const notificationRoutes = require("./routes/notifications");

// Mount routes
app.use("/api/auth",          authRoutes);
app.use("/api/users",         userRoutes);
app.use("/api/jobs",          jobRoutes);
app.use("/api/wallet",        walletRoutes);
app.use("/api/contracts",     contractRoutes);
app.use("/api/messages",      messageRoutes);
app.use("/api/notifications", notificationRoutes);

// =============================================================================
// HEALTH CHECK endpoint
// -----------------------------------------------------------------------------
// A simple GET /api/health route that returns 200 OK with basic status info.
// Useful for:
//   - Uptime monitoring services (UptimeRobot, Better Uptime)
//   - Docker HEALTHCHECK directives
//   - Load balancer health probes
// =============================================================================
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    dbState: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// =============================================================================
// 404 HANDLER — Catches any request that didn't match a route above
// -----------------------------------------------------------------------------
// This must come AFTER all route definitions.
// Returns JSON (not HTML) since all clients expect JSON from this API.
// =============================================================================
app.use((_req, res) => {
  res.status(404).json({ message: "Route not found." });
});

// =============================================================================
// GLOBAL ERROR HANDLER
// -----------------------------------------------------------------------------
// Express calls this middleware when any route calls next(err) or throws
// an unhandled synchronous error.
//
// Note: For async route handlers, unhandled promise rejections do NOT
// automatically flow here in Express 4. You must either:
//   a) Wrap every async handler in try/catch (what we do in this project), OR
//   b) npm install express-async-errors and require it at the top of server.js
//      (this monkey-patches Express to catch async errors automatically).
// =============================================================================
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    message: err.message || "An unexpected server error occurred.",
  });
});

// =============================================================================
// SERVER START
// =============================================================================
const PORT = process.env.PORT || 5000;

// Connect to DB first, then start listening for HTTP requests.
// This ordering guarantees the DB is ready before any request can arrive.
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Campus Gigs API running on http://localhost:${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
  });
});

module.exports = app; // Export for testing (e.g. with Jest + Supertest)
