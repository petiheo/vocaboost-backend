const jwt = require('jsonwebtoken');

function generateToken(payload) {
    return jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '24h' }
    );
}

function generateEmailVerificationToken(userId) {
    return jwt.sign(
        { userId, type: 'email_verification' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
}

module.exports = {
    generateToken,
    generateEmailVerificationToken
};
