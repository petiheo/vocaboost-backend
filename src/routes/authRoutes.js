const router = require('express').Router();
const passport = require('passport');
const authController = require('../controllers/authController');
const rateLimiters = require('../middleware/protection/rateLimiter');
const loginAttempts = require('../middleware/protection/loginAttempts');
const { authValidators } = require('../middleware/validation/validators');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation/validators');

// Register
router.post('/register', 
  rateLimiters.auth,
  authValidators.register,
  authController.register
);


// Login with login attempts tracking
router.post('/login',
  rateLimiters.auth,
  authValidators.login,
  loginAttempts.checkLoginAttempts(),
  authController.login
);

// Google OAuth
router.get('/google', 
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    authController.googleLogin
);

// Logout
router.post('/logout', authController.logout);

// Forgot password
router.post('/forgot-password',
  rateLimiters.auth,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Invalid email format'),
    handleValidationErrors
  ],
  authController.forgotPassword
);

// Reset password
router.post('/reset-password',
  rateLimiters.auth,
  [
    body('token')
      .notEmpty()
      .withMessage('Token is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase and number'),
    handleValidationErrors
  ],
  authController.resetPassword
);

// Verify email
router.get('/verify-email/:token', authController.verifyEmail);

// Resend verification email
router.post('/resend-verification',
  rateLimiters.email,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Invalid email format'),
    handleValidationErrors
  ],
  authController.resendVerificationEmail
);

module.exports = router;