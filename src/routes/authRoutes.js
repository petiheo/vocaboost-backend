const router = require('express').Router();
const passport = require('passport');
const authController = require('../controllers/authController');
const validators = require('../middleware/validators');

// Register
router.post('/register', validators.register, authController.register);

// Login
router.post('/login', validators.login, authController.login);

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

module.exports = router;