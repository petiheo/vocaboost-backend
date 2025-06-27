// routes/vocabularyRoutes.js (REFACTORED)
const router = require('express').Router();
const vocabularyController = require('../controllers/vocabularyController');
const { authenticateJWT, optionalAuth } = require('../middleware/auth');
const rateLimiters = require('../middleware/protection/rateLimiter');

// Get validation schemas from controller
const schemas = vocabularyController.getValidationSchemas();

// Public routes (optional auth for personalized data)
router.get('/', 
    optionalAuth, 
    schemas.getLists,           // Schema layer validation
    vocabularyController.getLists
);

router.get('/search', 
    optionalAuth, 
    schemas.searchVocabulary,   // Schema layer validation
    vocabularyController.searchVocabulary
);

router.get('/:id', 
    optionalAuth, 
    vocabularyController.getList
);

router.get('/:id/stats', 
    optionalAuth, 
    vocabularyController.getListStats
);

// Protected routes - require authentication
router.use(authenticateJWT);

// Vocabulary list management
router.post('/', 
    rateLimiters.upload,        // Rate limiting
    schemas.createList,         // Schema layer validation
    vocabularyController.createList
);

router.put('/:id', 
    schemas.updateList,         // Schema layer validation
    vocabularyController.updateList
);

router.delete('/:id', 
    vocabularyController.deleteList
);

// List operations
router.post('/:id/share', 
    rateLimiters.email,         // Rate limiting for email operations
    schemas.shareList,          // Schema layer validation
    vocabularyController.shareList
);

router.post('/:id/clone', 
    schemas.cloneList,          // Schema layer validation
    vocabularyController.cloneList
);

router.get('/:id/export', 
    vocabularyController.exportList
);

// Import operations
router.post('/import', 
    rateLimiters.upload,        // Rate limiting
    schemas.importList,         // Schema layer validation
    vocabularyController.importList
);

// Word management
router.post('/:listId/words', 
    schemas.addWord,            // Schema layer validation
    vocabularyController.addWord
);

router.post('/:listId/words/batch', 
    rateLimiters.upload,        // Rate limiting for batch operations
    schemas.batchAddWords,      // Schema layer validation
    vocabularyController.batchAddWords
);

router.put('/:listId/words/:wordId', 
    schemas.updateWord,         // Schema layer validation
    vocabularyController.updateWord
);

router.delete('/:listId/words/:wordId', 
    vocabularyController.deleteWord
);

// AI-powered features
router.post('/:listId/generate-examples', 
    rateLimiters.upload,        // Rate limiting for AI operations
    schemas.generateExamples,   // Schema layer validation
    vocabularyController.generateExamples
);

// Personalized features
router.get('/recommendations/personal', 
    vocabularyController.getRecommendations
);

module.exports = router;

// ============================================================================

// routes/reviewRoutes.js (REFACTORED)
const reviewController = require('../controllers/reviewController');
const { ReviewSessionSchema } = require('../models/schemas/review/ReviewSessionSchema');

const reviewRouter = require('express').Router();

// Apply authentication to all routes
reviewRouter.use(authenticateJWT);

// Get validation schemas
const reviewSchemas = {
    submitReview: ReviewSessionSchema.submitReviewSchema(),
    setDailyGoal: ReviewSessionSchema.dailyGoalSchema(),
    getStats: ReviewSessionSchema.getStatsSchema()
};

// USC4: Get review queue
reviewRouter.get('/queue',
    reviewSchemas.getQueue,     // Schema layer validation
    reviewController.getReviewQueue
);

// Submit review result
reviewRouter.post('/submit',
    rateLimiters.review,        // Rate limiting
    reviewSchemas.submitReview, // Schema layer validation
    reviewController.submitReview
);

// USC5: Flashcard session
reviewRouter.get('/flashcard',
    reviewSchemas.createSession, // Schema layer validation
    reviewController.getFlashcardSession
);

// USC6: Fill-in-blank session
reviewRouter.get('/fill-in-blank',
    reviewSchemas.createSession, // Schema layer validation
    reviewController.getFillInBlankSession
);

// USC7: Word association session
reviewRouter.get('/word-association',
    reviewSchemas.createSession, // Schema layer validation
    reviewController.getWordAssociationSession
);

// USC13: Learning statistics
reviewRouter.get('/stats',
    reviewSchemas.getStats,      // Schema layer validation
    reviewController.getLearningStats
);

// Daily goal management
reviewRouter.post('/daily-goal',
    reviewSchemas.setDailyGoal,  // Schema layer validation
    reviewController.setDailyGoal
);

// Streak information
reviewRouter.get('/streak', 
    reviewController.getStreakInfo
);

module.exports = reviewRouter;

// ============================================================================

// routes/userRoutes.js (REFACTORED)
const userController = require('../controllers/userController');
const { UserProfileSchema, UserSettingsSchema } = require('../models/schemas/user/UserProfileSchema');

const userRouter = require('express').Router();

// Public routes
userRouter.get('/check-email/:email', 
    userController.checkEmailAvailability
);

// Protected routes
userRouter.use(authenticateJWT);

// Get validation schemas
const userSchemas = {
    updateProfile: UserProfileSchema.updateSchema(),
    updateSettings: UserSettingsSchema.updateSchema(),
    changePassword: UserProfileSchema.changePasswordSchema(),
    reportContent: UserProfileSchema.reportContentSchema()
};

// Profile management
userRouter.get('/profile', 
    userController.getProfile
);

userRouter.put('/profile',
    userSchemas.updateProfile,   // Schema layer validation
    userController.updateProfile
);

// Settings management
userRouter.get('/settings', 
    userController.getSettings
);

userRouter.put('/settings',
    userSchemas.updateSettings,  // Schema layer validation
    userController.updateSettings
);

// Password management
userRouter.post('/change-password',
    userSchemas.changePassword,  // Schema layer validation
    userController.changePassword
);

// Content reporting
userRouter.post('/report',
    userSchemas.reportContent,   // Schema layer validation
    userController.reportContent
);

// Notifications
userRouter.get('/notifications', 
    userController.getNotifications
);

userRouter.post('/notifications/mark-read',
    userController.markNotificationsRead
);

userRouter.delete('/notifications/:id',
    userController.deleteNotification
);

// Account management
userRouter.delete('/account',
    userController.deleteAccount
);

// Learning data
userRouter.get('/learning-history', 
    userController.getLearningHistory
);

userRouter.get('/achievements', 
    userController.getAchievements
);

userRouter.post('/export-data', 
    userController.requestDataExport
);

module.exports = userRouter;