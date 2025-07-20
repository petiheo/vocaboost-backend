const { body, validationResult } = require('express-validator');

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

// Common validation patterns
const commonValidators = {
  email: (field = 'email') =>
    body(field)
      .trim()
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Invalid email format')
      .normalizeEmail()
      .isLength({ max: 255 })
      .withMessage('Email too long'),

  password: (field = 'password') =>
    body(field)
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be 8-128 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase and number'),
};

const authValidators = {
  register: [
    commonValidators.email(),
    commonValidators.password(),
    body('role')
      .optional()
      .trim()
      .isIn(['learner', 'teacher'])
      .withMessage('Role must be learner or teacher'),
    handleValidationErrors,
  ],

  login: [
    commonValidators.email(),
    body('password').notEmpty().withMessage('Password is required'),
    handleValidationErrors,
  ],

  resetPassword: [
    body('token').trim().notEmpty().withMessage('Reset token is required'),
    commonValidators.email('newPassword'),
    handleValidationErrors,
  ],

  email: [commonValidators.email()],
};

module.exports = {
  handleValidationErrors,
  commonValidators,
  authValidators,
};
