const router = require('express').Router();
const reviewController = require('../controllers/reviewController');
const { authenticateJWT } = require('../middleware/auth');
const rateLimiters = require('../middleware/protection/rateLimiter');
const { reviewValidators } = require('../middleware/validation/validators');
const { body, query } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation/validators');

// Apply authentication to all routes
router.use(authenticateJWT);

// USC4: Get review queue
router.get('/queue',
    [
        query('limit').optional().isInt({ min: 1, max: 50 }),
        handleValidationErrors
    ],
    reviewController.getReviewQueue
);

// Submit review result
router.post('/submit',
  rateLimiters.review,
  reviewValidators.submitReview,
  reviewController.submitReview
);

// USC5: Flashcard session
router.get('/flashcard',
    [
        query('listId').optional().isUUID(),
        query('limit').optional().isInt({ min: 1, max: 50 }),
        handleValidationErrors
    ],
    reviewController.getFlashcardSession
);

// USC6: Fill-in-blank session
router.get('/fill-in-blank',
    [
        query('listId').optional().isUUID(),
        query('difficulty').optional().isIn(['beginner', 'intermediate', 'advanced', 'all']),
        query('limit').optional().isInt({ min: 1, max: 20 }),
        handleValidationErrors
    ],
    reviewController.getFillInBlankSession
);

// USC7: Word association session
router.get('/word-association',
    [
        query('listId').optional().isUUID(),
        query('limit').optional().isInt({ min: 4, max: 20 }),
        handleValidationErrors
    ],
    reviewController.getWordAssociationSession
);

// USC13: Learning statistics
router.get('/stats',
    [
        query('period').optional().isIn(['24h', '7d', '30d', 'all']),
        handleValidationErrors
    ],
    reviewController.getLearningStats
);

// Daily goal
router.post('/daily-goal',
    [
        body('goal').isInt({ min: 1, max: 100 }),
        handleValidationErrors
    ],
    reviewController.setDailyGoal
);

// Streak info
router.get('/streak', reviewController.getStreakInfo);

module.exports = router;