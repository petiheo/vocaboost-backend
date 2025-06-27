// routes/authRoutes.js (REFACTORED)
const router = require('express').Router();
const passport = require('passport');
const authController = require('../controllers/authController');
const rateLimiters = require('../middleware/protection/rateLimiter');

// Get validation schemas from controller
const validationSchemas = authController.getValidationSchemas();

// Register
router.post('/register', 
    rateLimiters.auth,
    validationSchemas.register,  // Using schema from Model layer
    authController.register
);

// Login
router.post('/login',
    rateLimiters.auth,
    validationSchemas.login,     // Using schema from Model layer
    authController.login
);

// Google OAuth
router.get('/google', 
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
    validationSchemas.oauthCallback,  // Using schema from Model layer
    passport.authenticate('google', { failureRedirect: '/login' }),
    authController.googleLogin
);

// Logout
router.post('/logout', authController.logout);

// Forgot password
router.post('/forgot-password', 
    rateLimiters.email,
    validationSchemas.forgotPassword,  // Using schema from Model layer
    authController.forgotPassword
);

// Reset password
router.post('/reset-password',
    rateLimiters.auth,
    validationSchemas.resetPassword,   // Using schema from Model layer
    authController.resetPassword
);

// Verify email
router.get('/verify-email/:token', 
    validationSchemas.verifyEmail,     // Using schema from Model layer
    authController.verifyEmail
);

// Resend verification email
router.post('/resend-verification',
    rateLimiters.email,
    authController.resendVerificationEmail
);

// Check account status
router.get('/account-status',
    authController.checkAccountStatus
);

// Create session (for device tracking)
router.post('/session',
    authController.createSession
);

// Refresh token
router.post('/refresh',
    validationSchemas.refreshToken,    // Using schema from Model layer
    authController.refreshToken
);

module.exports = router;