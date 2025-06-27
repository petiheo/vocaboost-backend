const express = require('express');
const passport = require('passport');

const routes = require('./routes');
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

// Apply middleware layers
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

// API Routes - now using the new 3-layer architecture
app.use('/api', routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;