// src/app.js

const express = require('express');
const passport = require('passport');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const vocabularyRoutes = require('./routes/vocabularyRoutes');
const tagRoutes = require('./routes/tagRoutes'); // <-- 1. IMPORT the new tag router
const reviewRoutes = require('./routes/reviewRoutes');
const classroomRoutes = require('./routes/classroomRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Import middleware
const { securityMiddleware } = require('./middleware/core/security');
const { requestLogger, auditLogger } = require('./middleware/core/logging');
const { parsingMiddleware } = require('./middleware/core/parsing');
const { sessionMiddleware } = require('./middleware/core/session');
const { requestId, requestContext } = require('./middleware/monitoring/requestId');
const { performanceMonitor } = require('./middleware/monitoring/performance');
const { errorHandler, notFoundHandler } = require('./middleware/monitoring/errorHandler');
const rateLimiters = require('./middleware/protection/rateLimiter');

// Import passport config
require('./config/auth');

// Create Express app
const app = express();

// Basic middleware - this setup is excellent and requires no changes
app.use(requestId);
app.use(requestContext);
app.use(performanceMonitor);
app.use(...securityMiddleware());
app.use(requestLogger);
app.use(...parsingMiddleware());
app.use(sessionMiddleware);
app.use('/api/', rateLimiters.global);
app.use('/api/', auditLogger);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// API Routes - Mount all the application's routers
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vocabulary', vocabularyRoutes);
app.use('/api/tags', tagRoutes); // <-- 2. MOUNT the tag router at the /api/tags endpoint
app.use('/api/review', reviewRoutes);
app.use('/api/classrooms', classroomRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

// 404 handler for any routes not matched above
app.use(notFoundHandler);

// Final global error handling middleware
app.use(errorHandler);

module.exports = app;