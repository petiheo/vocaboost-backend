const { body, param, query, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false,
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// Common validation patterns
const commonValidators = {
  uuid: (field = 'id') => param(field).isUUID().withMessage('Invalid ID format'),
  
  email: (field = 'email') => 
    body(field)
      .isEmail()
      .normalizeEmail()
      .withMessage('Invalid email format'),
  
  password: (field = 'password') =>
    body(field)
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be 8-128 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase and number'),
  
  pagination: [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('sort').optional().isIn(['asc', 'desc']),
    query('sortBy').optional().isLength({ min: 1, max: 50 })
  ]
};

// Specific validators for each domain
const authValidators = {
  register: [
    commonValidators.email(),
    commonValidators.password(),
    // body('fullName').trim().isLength({ min: 2, max: 100 }),
    body('role').optional().isIn(['learner', 'teacher']),
    handleValidationErrors
  ],
  
  login: [
    commonValidators.email(),
    body('password').notEmpty(),
    handleValidationErrors
  ]
};

const vocabularyValidators = {
  createList: [
    body('title').trim().isLength({ min: 1, max: 200 }),
    body('description').optional().trim().isLength({ max: 1000 }),
    body('language').isIn(['en', 'vi', 'fr', 'de', 'ja', 'ko']),
    body('difficulty').optional().isIn(['beginner', 'intermediate', 'advanced']),
    body('isPublic').optional().isBoolean(),
    handleValidationErrors
  ],
  
  addWord: [
    body('word').trim().isLength({ min: 1, max: 100 }),
    body('translation').trim().isLength({ min: 1, max: 200 }),
    body('definition').optional().trim().isLength({ max: 500 }),
    body('example').optional().trim().isLength({ max: 300 }),
    body('pronunciation').optional().trim().isLength({ max: 100 }),
    handleValidationErrors
  ]
};

const reviewValidators = {
  submitReview: [
    body('vocabularyId').isUUID(),
    body('performance').isInt({ min: 0, max: 3 }),
    body('responseTime').optional().isInt({ min: 0, max: 300000 }),
    body('isNew').optional().isBoolean(),
    handleValidationErrors
  ]
};

const classroomValidators = {
  create: [
    body('name').trim().isLength({ min: 1, max: 100 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('gradeLevel').optional().isInt({ min: 1, max: 12 }),
    body('maxLearners').optional().isInt({ min: 1, max: 100 }),
    handleValidationErrors
  ],
  
  invite: [
    commonValidators.uuid('classroomId'),
    body('emails').isArray({ min: 1, max: 50 }),
    body('emails.*').isEmail(),
    handleValidationErrors
  ]
};

module.exports = {
  handleValidationErrors,
  commonValidators,
  authValidators,
  vocabularyValidators,
  reviewValidators,
  classroomValidators
};