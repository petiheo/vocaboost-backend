const express = require('express');
const passport = require('passport');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const vocabularyRoutes = require('./routes/vocabularyRoutes');
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

// Basic middleware - tương tự như FastAPI middleware
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

// API Routes - tương tự như router trong FastAPI
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vocabulary', vocabularyRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/classrooms', classroomRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

// 404 handler
app.use(notFoundHandler);
app.use(errorHandler);

// Error handling middleware - phải đặt cuối cùng
app.use(errorHandler);

module.exports = app;