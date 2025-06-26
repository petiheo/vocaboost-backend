const router = require('express').Router();
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const vocabularyRoutes = require('./vocabularyRoutes');
const reviewRoutes = require('./reviewRoutes');
const classroomRoutes = require('./classroomRoutes');
const adminRoutes = require('./adminRoutes');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/vocabulary', vocabularyRoutes);
router.use('/review', reviewRoutes);
router.use('/classrooms', classroomRoutes);
router.use('/admin', adminRoutes);

router.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0'
    });
});

module.exports = router;
