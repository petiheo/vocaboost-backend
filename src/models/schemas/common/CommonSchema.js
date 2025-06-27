const { query, param, validationResult } = require('express-validator');
const PaginationSchema = require('./PaginationSchema');

class CommonSchema {
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

    static idParam(field = 'id') {
        return param(field)
            .isUUID()
            .withMessage('Invalid ID format');
    }

    static paginationSchema(options = {}) {
        return PaginationSchema.pagination(options);
    }
}

module.exports = CommonSchema;
