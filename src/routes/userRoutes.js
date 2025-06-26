const router = require('express').Router();
const userController = require('../controllers/userController');
const { authenticateJWT } = require('../middleware/auth');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation/validators');

// Public routes
router.get('/check-email/:email', userController.checkEmailAvailability);

// Protected routes
router.use(authenticateJWT);

// Profile management
router.get('/profile', userController.getProfile);

router.put('/profile',
    [
        body('fullName').optional().trim().isLength({ min: 2, max: 100 }),
        body('avatarUrl').optional().isURL(),
        handleValidationErrors
    ],
    userController.updateProfile
);

// Settings
router.get('/settings', userController.getSettings);

router.put('/settings',
    [
        body('dailyGoal').optional().isInt({ min: 1, max: 100 }),
        body('notificationEmail').optional().isBoolean(),
        body('notificationPush').optional().isBoolean(),
        body('timezone').optional().isIn(['Asia/Ho_Chi_Minh', 'UTC']),
        body('language').optional().isIn(['vi', 'en']),
        body('theme').optional().isIn(['light', 'dark', 'auto']),
        handleValidationErrors
    ],
    userController.updateSettings
);

// Password management
router.post('/change-password',
    [
        body('currentPassword').notEmpty(),
        body('newPassword')
            .isLength({ min: 8 })
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
            .withMessage('Password must contain uppercase, lowercase and number'),
        handleValidationErrors
    ],
    userController.changePassword
);

// USC22: Report content
router.post('/report',
    [
        body('contentType').isIn(['vocabulary_lists', 'vocabulary_items', 'users']),
        body('contentId').isUUID(),
        body('reason').isIn(['inappropriate', 'spam', 'copyright', 'other']),
        body('description').optional().trim().isLength({ max: 500 }),
        handleValidationErrors
    ],
    userController.reportContent
);

// Notifications
router.get('/notifications', userController.getNotifications);

router.post('/notifications/mark-read',
    [
        body('notificationIds').isArray().notEmpty(),
        body('notificationIds.*').isUUID(),
        handleValidationErrors
    ],
    userController.markNotificationsRead
);

router.delete('/notifications/:id',
    userController.deleteNotification
);

// Account management
router.delete('/account',
    [
        body('password').notEmpty(),
        body('reason').optional().trim(),
        handleValidationErrors
    ],
    userController.deleteAccount
);

// Learning history
router.get('/learning-history', userController.getLearningHistory);

// Achievements
router.get('/achievements', userController.getAchievements);

// Export data
router.post('/export-data', userController.requestDataExport);

module.exports = router;