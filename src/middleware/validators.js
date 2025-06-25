const { body, param, query, validationResult } = require('express-validator');

// Middleware để handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            errors: errors.array().map(err => ({
                field: err.param,
                message: err.msg
            }))
        });
    }
    next();
};

// Common validators
const validators = {
    // Pagination
    pagination: [
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 })
    ],
    
    // UUID param
    uuidParam: (paramName = 'id') => [
        param(paramName).isUUID().withMessage('Invalid ID format')
    ],
    
    // Email
    email: (fieldName = 'email') => 
        body(fieldName)
            .isEmail()
            .normalizeEmail()
            .withMessage('Invalid email format'),
    
    // Password
    password: (fieldName = 'password') =>
        body(fieldName)
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
            .withMessage('Password must contain uppercase, lowercase and number'),
    
    // Text fields
    textField: (fieldName, min = 1, max = 255) =>
        body(fieldName)
            .trim()
            .isLength({ min, max })
            .withMessage(`${fieldName} must be between ${min} and ${max} characters`),
    
    // Array
    arrayField: (fieldName, minLength = 1) =>
        body(fieldName)
            .isArray({ min: minLength })
            .withMessage(`${fieldName} must be an array with at least ${minLength} items`)
};

// Specific validators for each feature
const authValidators = {
    register: [
        validators.email(),
        validators.password(),
        body('fullName').trim().isLength({ min: 2, max: 100 }),
        body('role').optional().isIn(['student', 'teacher']),
        handleValidationErrors
    ],
    
    login: [
        validators.email(),
        body('password').notEmpty(),
        handleValidationErrors
    ],
    
    forgotPassword: [
        validators.email(),
        handleValidationErrors
    ],
    
    resetPassword: [
        body('token').notEmpty(),
        validators.password('newPassword'),
        handleValidationErrors
    ]
};

const vocabularyValidators = {
    createList: [
        validators.textField('name', 1, 100),
        body('description').optional().trim().isLength({ max: 500 }),
        body('privacy').isIn(['public', 'private', 'classroom']),
        body('tags').optional().isArray(),
        body('words').optional().isArray(),
        handleValidationErrors
    ],
    
    addWord: [
        validators.textField('word', 1, 100),
        validators.textField('meaning', 1, 500),
        body('pronunciation').optional().trim(),
        body('exampleSentence').optional().trim(),
        body('imageUrl').optional().isURL(),
        handleValidationErrors
    ]
};

const reviewValidators = {
    submitReview: [
        body('vocabularyId').isUUID(),
        body('performance').isInt({ min: 0, max: 3 }),
        body('responseTime').optional().isInt({ min: 0 }),
        body('isNew').optional().isBoolean(),
        handleValidationErrors
    ]
};

const classroomValidators = {
    create: [
        validators.textField('name', 1, 100),
        body('description').optional().trim().isLength({ max: 500 }),
        body('subject').optional().trim(),
        body('gradeLevel').optional().isInt({ min: 1, max: 12 }),
        body('maxStudents').optional().isInt({ min: 1, max: 100 }),
        handleValidationErrors
    ],
    
    invite: [
        validators.arrayField('emails'),
        body('emails.*').isEmail(),
        body('message').optional().trim().isLength({ max: 500 }),
        handleValidationErrors
    ],
    
    assignment: [
        validators.textField('title', 1, 200),
        body('description').optional().trim(),
        body('assignmentType').isIn(['vocabulary', 'quiz', 'essay', 'speaking']),
        body('dueDate').optional().isISO8601(),
        body('vocabularyIds').optional().isArray(),
        body('vocabularyIds.*').optional().isUUID(),
        handleValidationErrors
    ]
};

module.exports = {
    handleValidationErrors,
    validators,
    authValidators,
    vocabularyValidators,
    reviewValidators,
    classroomValidators
};