// routes/index.js

const router = require('express').Router();
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const vocabularyRoutes = require('./vocabularyRoutes');
const tagRoutes = require('./tagRoutes'); // <-- Import new tag routes
const reviewRoutes = require('./reviewRoutes');
const classroomRoutes = require('./classroomRoutes');
const adminRoutes = require('./adminRoutes');

// Mount all the specific routers onto the main router
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/vocabulary', vocabularyRoutes);
router.use('/tags', tagRoutes); // <-- Mount the new tag routes at /api/tags
router.use('/review', reviewRoutes);
router.use('/classrooms', classroomRoutes);
router.use('/admin', adminRoutes);

// Main health check endpoint for the API
router.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0'
    });
});

module.exports = router;