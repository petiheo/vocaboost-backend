const jwt = require('jsonwebtoken');
const passport = require('passport');

// Middleware để verify JWT token - tương tự như dependencies trong FastAPI
const authenticateJWT = (req, res, next) => {
    passport.authenticate('jwt', { session: false }, (err, user, info) => {
        if (err) {
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

// Middleware để check role - tương tự như Depends trong FastAPI
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                error: 'Forbidden', 
                message: 'You do not have permission to access this resource' 
            });
        }
        
        next();
    };
};

// Middleware optional authentication
const optionalAuth = (req, res, next) => {
    passport.authenticate('jwt', { session: false }, (err, user) => {
        req.user = user || null;
        next();
    })(req, res, next);
};

module.exports = {
    authenticateJWT,
    requireRole,
    optionalAuth
};