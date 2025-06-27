const { body, query } = require('express-validator');

class DateTimeSchema {
    static isoDate(field, location = 'body') {
        const validator = location === 'query' ? query(field) : body(field);
        return validator
            .isISO8601()
            .withMessage(`${field} must be a valid ISO8601 date`)
            .toDate();
    }
}

module.exports = DateTimeSchema;
