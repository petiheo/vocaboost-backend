// models/schemas/auth/AuthSchema.js
const { body, param, query, validationResult } = require('express-validator');

class AuthSchema {
    
    // Validation error handler
    static handleValidationErrors(req, res, next) {
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
    }

    // Common validation rules
    static email(field = 'email') {
        return body(field)
            .isEmail()
            .withMessage('Email format is invalid')
            .normalizeEmail()
            .isLength({ max: 255 })
            .withMessage('Email must not exceed 255 characters');
    }

    static password(field = 'password') {
        return body(field)
            .isLength({ min: 8, max: 128 })
            .withMessage('Password must be between 8-128 characters')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
            .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number');
    }

    static strongPassword(field = 'password') {
        return body(field)
            .isLength({ min: 8, max: 128 })
            .withMessage('Password must be between 8-128 characters')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
            .withMessage('Password must contain uppercase, lowercase, number, and special character');
    }

    static fullName(field = 'fullName') {
        return body(field)
            .optional()
            .trim()
            .isLength({ min: 2, max: 100 })
            .withMessage('Full name must be between 2-100 characters')
            .matches(/^[a-zA-ZÀ-ÿ\s]+$/)
            .withMessage('Full name can only contain letters and spaces');
    }

    static role(field = 'role') {
        return body(field)
            .optional()
            .isIn(['learner', 'teacher'])
            .withMessage('Role must be either learner or teacher');
    }

    // Registration validation schema
    static registerSchema() {
        return [
            this.email(),
            this.password(),
            this.fullName(),
            this.role(),
            this.handleValidationErrors
        ];
    }

    // Login validation schema
    static loginSchema() {
        return [
            this.email(),
            body('password')
                .notEmpty()
                .withMessage('Password is required'),
            this.handleValidationErrors
        ];
    }

    // Forgot password validation schema
    static forgotPasswordSchema() {
        return [
            this.email(),
            this.handleValidationErrors
        ];
    }

    // Reset password validation schema
    static resetPasswordSchema() {
        return [
            body('token')
                .notEmpty()
                .withMessage('Reset token is required')
                .isLength({ min: 1 })
                .withMessage('Invalid reset token format'),
            this.password('newPassword'),
            this.handleValidationErrors
        ];
    }

    // Change password validation schema
    static changePasswordSchema() {
        return [
            body('currentPassword')
                .notEmpty()
                .withMessage('Current password is required'),
            this.password('newPassword'),
            body('confirmPassword')
                .custom((value, { req }) => {
                    if (value !== req.body.newPassword) {
                        throw new Error('Password confirmation does not match');
                    }
                    return true;
                }),
            this.handleValidationErrors
        ];
    }

    // Email verification validation schema
    static emailVerificationSchema() {
        return [
            param('token')
                .notEmpty()
                .withMessage('Verification token is required')
                .isJWT()
                .withMessage('Invalid verification token format'),
            this.handleValidationErrors
        ];
    }

    // OAuth callback validation schema
    static oauthCallbackSchema() {
        return [
            query('code')
                .optional()
                .isString()
                .withMessage('Invalid OAuth code'),
            query('state')
                .optional()
                .isString()
                .withMessage('Invalid OAuth state'),
            query('error')
                .optional()
                .isString()
                .withMessage('OAuth error must be a string'),
            this.handleValidationErrors
        ];
    }

    // Refresh token validation schema
    static refreshTokenSchema() {
        return [
            body('refreshToken')
                .notEmpty()
                .withMessage('Refresh token is required')
                .isJWT()
                .withMessage('Invalid refresh token format'),
            this.handleValidationErrors
        ];
    }

    // Account activation schema
    static accountActivationSchema() {
        return [
            body('activationCode')
                .notEmpty()
                .withMessage('Activation code is required')
                .isLength({ min: 6, max: 6 })
                .withMessage('Activation code must be 6 characters')
                .isAlphanumeric()
                .withMessage('Activation code must contain only letters and numbers'),
            this.handleValidationErrors
        ];
    }

    // Two-factor authentication setup schema
    static twoFactorSetupSchema() {
        return [
            body('secret')
                .notEmpty()
                .withMessage('2FA secret is required')
                .isBase32()
                .withMessage('Invalid 2FA secret format'),
            body('token')
                .notEmpty()
                .withMessage('2FA token is required')
                .isLength({ min: 6, max: 6 })
                .withMessage('2FA token must be 6 digits')
                .isNumeric()
                .withMessage('2FA token must contain only numbers'),
            this.handleValidationErrors
        ];
    }

    // Two-factor authentication verification schema
    static twoFactorVerifySchema() {
        return [
            body('token')
                .notEmpty()
                .withMessage('2FA token is required')
                .isLength({ min: 6, max: 6 })
                .withMessage('2FA token must be 6 digits')
                .isNumeric()
                .withMessage('2FA token must contain only numbers'),
            this.handleValidationErrors
        ];
    }
}

module.exports = AuthSchema;