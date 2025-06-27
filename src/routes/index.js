// routes/index.js (UPDATED)
const router = require('express').Router();

// Import refactored routes
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const vocabularyRoutes = require('./vocabularyRoutes');
const reviewRoutes = require('./reviewRoutes');
const classroomRoutes = require('./classroomRoutes');
const adminRoutes = require('./adminRoutes');

// Health check with system info
router.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        architecture: 'Refactored 3-Layer Model',
        layers: {
            controller: 'HTTP Request Handling',
            business_logic: 'Services & Algorithms',
            schema: 'Validation & Rules',
            repository: 'Data Access'
        }
    });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/vocabulary', vocabularyRoutes);
router.use('/review', reviewRoutes);
router.use('/classrooms', classroomRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
