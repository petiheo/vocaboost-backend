const router = require('express').Router();
const passport = require('passport');
const authController = require('../controllers/authController');
const { authValidators } = require('../middleware/validators');

// Register
router.post('/register', authValidators.register, authController.register);

// Login
router.post('/login', authValidators.login, authController.login);

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
router.post('/forgot-password', authController.forgotPassword);

// Verify email
router.get('/verify-email/:token', authController.verifyEmail);

module.exports = router;