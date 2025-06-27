// models/schemas/auth/PasswordSchema.js
const { body, validationResult } = require('express-validator');

class PasswordSchema {
    
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

    // Basic password validation
    static basicPassword(field = 'password') {
        return body(field)
            .isLength({ min: 8, max: 128 })
            .withMessage('Password must be between 8-128 characters')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
            .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number');
    }

    // Strong password validation
    static strongPassword(field = 'password') {
        return body(field)
            .isLength({ min: 8, max: 128 })
            .withMessage('Password must be between 8-128 characters')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
            .withMessage('Password must contain uppercase, lowercase, number, and special character (@$!%*?&)')
            .not()
            .matches(/(.)\1{2,}/)
            .withMessage('Password cannot contain more than 2 consecutive identical characters')
            .custom((value, { req }) => {
                // Check against common weak passwords
                const commonPasswords = [
                    'password', 'password123', '12345678', 'qwerty', 'abc123',
                    'Password1', 'admin123', 'welcome123', 'letmein123'
                ];
                
                if (commonPasswords.includes(value.toLowerCase())) {
                    throw new Error('Password is too common and easily guessable');
                }

                // Check if password contains parts of email
                if (req.body.email) {
                    const emailParts = req.body.email.split('@')[0].toLowerCase();
                    if (value.toLowerCase().includes(emailParts) && emailParts.length > 3) {
                        throw new Error('Password should not contain parts of your email address');
                    }
                }

                // Check if password contains parts of name
                if (req.body.fullName) {
                    const nameParts = req.body.fullName.toLowerCase