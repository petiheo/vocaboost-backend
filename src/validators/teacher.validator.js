const { body, param, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map((err) => ({
        field: err.param,
        message: err.msg,
        value: err.value,
      })),
    });
  }
  next();
};

const teacherValidators = {
  submitVerification: [
    body('fullName')
      .trim()
      .notEmpty()
      .withMessage('Full name is required')
      .isLength({ min: 2, max: 100 })
      .withMessage('Full name must be between 2 and 100 characters')
      .matches(/^[a-zA-Z\s\u00C0-\u1EF9]+$/)
      .withMessage('Full name can only contain letters and spaces'),
    
    body('institution')
      .trim()
      .notEmpty()
      .withMessage('School/Institution name is required')
      .isLength({ min: 2, max: 200 })
      .withMessage('Institution name must be between 2 and 200 characters'),
    
    body('schoolEmail')
      .trim()
      .notEmpty()
      .withMessage('School email is required')
      .isEmail()
      .withMessage('Invalid email format')
      .normalizeEmail()
      .isLength({ max: 255 })
      .withMessage('Email too long'),
    
    body('additionalNotes')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Additional notes must not exceed 1000 characters'),
    
    handleValidationErrors,
  ],

  rejectRequest: [
    param('requestId')
      .isUUID()
      .withMessage('Invalid request ID'),
    
    body('rejectionReason')
      .trim()
      .notEmpty()
      .withMessage('Rejection reason is required')
      .isLength({ min: 10, max: 500 })
      .withMessage('Rejection reason must be between 10 and 500 characters'),
    
    handleValidationErrors,
  ],
};

module.exports = {
  teacherValidators,
};