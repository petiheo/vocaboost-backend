const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const passport = require('passport');
const session = require('express-session');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const vocabularyRoutes = require('./routes/vocabularyRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const classroomRoutes = require('./routes/classroomRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');

// Import passport config
require('./config/auth');

// Create Express app
const app = express();

// Basic middleware - tương tự như FastAPI middleware
app.use(helmet()); // Security headers
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true
}));
app.use(morgan('dev')); // Logging
app.use(express.json()); // Parse JSON body
app.use(express.urlencoded({ extended: true }));

// Session middleware for OAuth
app.use(session({
    secret: process.env.SESSION_SECRET || 'vocaboost-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Rate limiting
app.use('/api/', rateLimiter);

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
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware - phải đặt cuối cùng
app.use(errorHandler);

module.exports = app;