const { authenticateJWT, optionalAuth, refreshTokenAuth } = require('./authenticate');
const { requireRole, requireOwnership, requireClassroomAccess } = require('./authorize');

module.exports = {
    // Authentication middleware
    authenticateJWT,
    optionalAuth,
    refreshTokenAuth,
    
    // Authorization middleware
    requireRole,
    requireOwnership,
    requireClassroomAccess
};