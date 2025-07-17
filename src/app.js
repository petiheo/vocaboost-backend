const express = require("express");
const passport = require("passport");

// Import routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const vocabularyRoutes = require("./routes/vocabularyRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const classroomRoutes = require("./routes/classroomRoutes");
const adminRoutes = require("./routes/adminRoutes");

// Import middleware
const { securityMiddleware } = require("./middleware/core/security");
const { requestLogger, auditLogger } = require("./middleware/core/logging");
const { parsingMiddleware } = require("./middleware/core/parsing");
const { sessionMiddleware } = require("./middleware/core/session");
const {
  requestId,
  requestContext,
} = require("./middleware/monitoring/requestId");
const { performanceMonitor } = require("./middleware/monitoring/performance");
const {
  errorHandler,
  notFoundHandler,
} = require("./middleware/monitoring/errorHandler");
const rateLimiters = require("./middleware/protection/rateLimiter");

// Import and initialize passport configuration
// This sets up both JWT and Google OAuth strategies
require("./config/auth");

// Create Express app
const app = express();

// ================================
// CORE MIDDLEWARE (Applied to all requests)
// ================================

// Request tracking and monitoring
app.use(requestId);
app.use(requestContext);
app.use(performanceMonitor);

// Security headers and CORS
app.use(...securityMiddleware());

// Request logging
app.use(requestLogger);

// Body parsing and compression
app.use(...parsingMiddleware());

// ================================
// SESSION MIDDLEWARE (OAuth only)
// ================================

// Sessions are ONLY used for Google OAuth flow
// After OAuth completion, we switch to JWT tokens
app.use(sessionMiddleware);

// ================================
// RATE LIMITING
// ================================

// Global rate limiting for all API routes
app.use("/api/", rateLimiters.global);

// Audit logging for authenticated requests
app.use("/api/", auditLogger);

// ================================
// PASSPORT INITIALIZATION
// ================================

// Initialize Passport for authentication
app.use(passport.initialize());

// Session support ONLY for OAuth flow
// Note: This does NOT affect JWT authentication which is stateless
app.use(passport.session());

// ================================
// API ROUTES
// ================================

// Authentication routes (includes both JWT and OAuth endpoints)
app.use("/api/auth", authRoutes);

// All other routes use JWT authentication
app.use("/api/users", userRoutes);
app.use("/api/vocabulary", vocabularyRoutes);
app.use("/api/review", reviewRoutes);
app.use("/api/classrooms", classroomRoutes);
app.use("/api/admin", adminRoutes);

// ================================
// HEALTH CHECK
// ================================

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || "1.0.0",
    authentication: {
      primary: "JWT",
      oauth: "Google",
      sessions: "OAuth flow only",
    },
  });
});

// Additional health check with authentication status
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date(),
    services: {
      database: "connected", // You might want to add actual health checks
      redis: process.env.REDIS_HOST ? "available" : "disabled",
      email: process.env.SMTP_HOST ? "configured" : "disabled",
    },
    authentication: {
      jwt: "enabled",
      google_oauth: process.env.GOOGLE_CLIENT_ID ? "enabled" : "disabled",
    },
  });
});

// ================================
// ERROR HANDLING
// ================================

// 404 handler for unknown routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
