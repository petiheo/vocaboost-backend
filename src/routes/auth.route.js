const express = require('express');
const authRouter = express.Router();
const passport = require('passport');

const rateLimiter = require('../middlewares/rateLimiter.middleware');
const { authValidators } = require('../validators/auth.validator');
const authController = require('../controllers/auth.controller');

// Registration & Login & Logout
authRouter.post(
  '/register',
  rateLimiter,
  authValidators.register,
  authController.register
);

authRouter.post(
  '/login',
  rateLimiter,
  authValidators.login,
  authController.login
);

authRouter.post('/logout', rateLimiter, authController.logout);

// OAuth Routes
authRouter.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    prompt: 'select_account', // Force account selection
  })
);

authRouter.get('/google/callback', authController.googleCallback);

// Password Reset Flow
authRouter.post(
  '/forgot-password',
  rateLimiter,
  authValidators.email,
  authController.forgotPassword
);

authRouter.post(
  '/reset-password',
  rateLimiter,
  authValidators.resetPassword,
  authController.resetPassword
);

authRouter.post('/verify-email/:token', authController.verifyEmail);

authRouter.post(
  '/resend-verification',
  authValidators.email,
  authController.resendVerification
);

module.exports = authRouter;
