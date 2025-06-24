const { body, param, query, validationResult } = require('express-validator');

// Middleware để handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// Validation rules cho các endpoints
const validators = {
    // Auth validators
    register: [
        body('email').isEmail().normalizeEmail(),
        body('password')
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
            .withMessage('Password must contain uppercase, lowercase and number'),
        body('role').isIn(['learner', 'teacher']),
        handleValidationErrors
    ],
    
    login: [
        body('email').isEmail().normalizeEmail(),
        body('password').notEmpty(),
        handleValidationErrors
    ],
    
    // Vocabulary validators
    createVocabularyList: [
        body('name').notEmpty().trim(),
        body('description').optional().trim(),
        body('privacy').isIn(['public', 'private', 'classroom']),
        body('words').isArray().optional(),
        handleValidationErrors
    ],
    
    // Review validators
    submitReview: [
        body('wordId').isUUID(),
        body('performance').isIn(['again', 'hard', 'good', 'easy']),
        handleValidationErrors
    ]
};

module.exports = validators;