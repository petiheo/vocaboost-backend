const { query } = require('express-validator');

class PaginationSchema {
    static pagination({ maxLimit = 100 } = {}) {
        return [
            query('page')
                .optional()
                .isInt({ min: 1 })
                .withMessage('Page must be a positive integer')
                .toInt(),
            query('limit')
                .optional()
                .isInt({ min: 1, max: maxLimit })
                .withMessage(`Limit must be between 1 and ${maxLimit}`)
                .toInt()
        ];
    }
}

module.exports = PaginationSchema;
