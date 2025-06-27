const { body, query, param, validationResult } = require('express-validator');

class TokenSchema {
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

    static jwt(field = 'token') {
        return body(field)
            .notEmpty()
            .withMessage(`${field} is required`)
            .isJWT()
            .withMessage(`Invalid ${field} format`);
    }

    static refreshToken(field = 'refreshToken') {
        return body(field)
            .notEmpty()
            .withMessage('Refresh token is required')
            .isJWT()
            .withMessage('Invalid refresh token format');
    }

    static paramToken(field = 'token') {
        return param(field)
            .notEmpty()
            .withMessage(`${field} is required`)
            .isJWT()
            .withMessage(`Invalid ${field} format`);
    }

    static queryToken(field = 'token') {
        return query(field)
            .optional()
            .isJWT()
            .withMessage(`Invalid ${field} format`);
    }
}

module.exports = TokenSchema;
