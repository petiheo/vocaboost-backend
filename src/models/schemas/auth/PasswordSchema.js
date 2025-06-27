const { body, validationResult } = require('express-validator');

class PasswordSchema {
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

    static basicPassword(field = 'password') {
        return body(field)
            .isLength({ min: 8, max: 128 })
            .withMessage('Password must be between 8-128 characters')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
            .withMessage('Password must contain uppercase, lowercase and number');
    }

    static strongPassword(field = 'password') {
        return body(field)
            .isLength({ min: 8, max: 128 })
            .withMessage('Password must be between 8-128 characters')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
            .withMessage('Password must contain uppercase, lowercase, number and special character')
            .not()
            .matches(/(.)\1{2,}/)
            .withMessage('Password cannot contain more than 2 consecutive identical characters')
            .custom((value, { req }) => {
                const commonPasswords = [
                    'password', 'password123', '12345678', 'qwerty', 'abc123',
                    'Password1', 'admin123', 'welcome123', 'letmein123'
                ];
                if (commonPasswords.includes(value.toLowerCase())) {
                    throw new Error('Password is too common');
                }
                if (req.body.email) {
                    const emailPart = req.body.email.split('@')[0].toLowerCase();
                    if (emailPart.length > 3 && value.toLowerCase().includes(emailPart)) {
                        throw new Error('Password should not contain parts of your email');
                    }
                }
                if (req.body.fullName) {
                    const parts = req.body.fullName.toLowerCase().split(/\s+/);
                    for (const part of parts) {
                        if (part.length > 3 && value.toLowerCase().includes(part)) {
                            throw new Error('Password should not contain parts of your name');
                        }
                    }
                }
                return true;
            });
    }
}

module.exports = PasswordSchema;
