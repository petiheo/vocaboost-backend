const jwt = require('jsonwebtoken');
const passport = require('passport');
const { logger } = require('../core/logging');

const authenticateJWT = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) {
      logger.error('Authentication error:', err);
      return res.status(500).json({ error: 'Authentication error' });
    }
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: info?.message || 'Invalid token' 
      });
    }
    
    req.user = user;
    next();
  })(req, res, next);
};

const optionalAuth = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user) => {
    req.user = user || null;
    next();
  })(req, res, next);
};

const refreshTokenAuth = (req, res, next) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required' });
  }
  
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
};

module.exports = { authenticateJWT, optionalAuth, refreshTokenAuth };