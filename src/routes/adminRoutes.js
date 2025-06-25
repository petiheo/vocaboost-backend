const router = require('express').Router();
const adminController = require('../controllers/adminController');
const { authenticateJWT, requireRole } = require('../middleware/authMiddleware');
const { apiLimiter } = require('../middleware/rateLimiter');

// Apply authentication and admin role to all routes
router.use(authenticateJWT);
router.use(requireRole('admin'));
router.use(apiLimiter);

// USC18: Ban/Unban accounts
router.post('/users/ban', adminController.banAccount);
router.post('/users/unban', adminController.unbanAccount);

// USC19: Teacher requests
router.get('/teacher-requests', adminController.getTeacherRequests);
router.post('/teacher-requests/:requestId/review', adminController.approveTeacherRequest);

// USC20: Content moderation
router.get('/reports', adminController.getReportedContent);
router.post('/reports/:reportId/moderate', adminController.moderateContent);

// USC21: System analytics
router.get('/analytics', adminController.getSystemAnalytics);
router.get('/analytics/export', adminController.exportAnalytics);

// Admin logs
router.get('/logs', adminController.getAdminLogs);

// System health
router.get('/health', adminController.getSystemHealth);

// User management
router.get('/users', adminController.getUsers);
router.put('/users/:userId', adminController.updateUser);
router.post('/users/bulk-action', adminController.bulkUserAction);

// Content management
router.get('/content/vocabulary', adminController.getVocabularyContent);
router.delete('/content/vocabulary/:id', adminController.removeVocabulary);

// Email management
router.post('/email/broadcast', adminController.sendBroadcastEmail);

module.exports = router;