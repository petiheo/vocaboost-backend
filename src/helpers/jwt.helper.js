const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRE = process.env.JWT_EXPIRE;

const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRE });
};

const generateEmailVerificationToken = (userId) => {
  return jwt.sign(
    {
      userId,
      type: 'email_verification',
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

const generateResetToken = (userId) => {
  return jwt.sign(
    {
      userId,
      type: 'password_reset',
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
};

const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

module.exports = {
  generateToken,
  generateEmailVerificationToken,
  generateResetToken,
  verifyToken,
};
