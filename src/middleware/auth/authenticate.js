const jwt = require("jsonwebtoken");
const passport = require("passport");
const { logger } = require("../core/logging");

/**
 * Primary JWT Authentication Middleware
 * This should be used for all API endpoints that require authentication
 */
const authenticateJWT = (req, res, next) => {
  passport.authenticate("jwt", { session: false }, (err, user, info) => {
    if (err) {
      logger.error("JWT Authentication error:", {
        error: err.message,
        requestId: req.id,
        ip: req.ip,
      });
      return res.status(500).json({
        success: false,
        error: "Authentication system error",
      });
    }

    if (!user) {
      // Log failed authentication attempts for security monitoring
      logger.warn("Failed JWT authentication:", {
        reason: info?.message || "Invalid token",
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        requestId: req.id,
        path: req.path,
      });

      return res.status(401).json({
        success: false,
        error: "Authentication required",
        message: info?.message || "Invalid or missing token",
      });
    }

    // Log successful authentication for analytics (optional)
    if (process.env.LOG_AUTH_SUCCESS === "true") {
      logger.info("Successful JWT authentication:", {
        userId: user.id,
        role: user.role,
        ip: req.ip,
        requestId: req.id,
      });
    }

    // Attach user to request object
    req.user = user;
    next();
  })(req, res, next);
};

/**
 * Optional Authentication Middleware
 * Use this for endpoints that can work both with and without authentication
 * For example: public vocabulary lists that show different content for logged-in users
 */
const optionalAuth = (req, res, next) => {
  // Check if Authorization header exists
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // No token provided - continue without authentication
    req.user = null;
    return next();
  }

  // Token provided - attempt to authenticate
  passport.authenticate("jwt", { session: false }, (err, user, info) => {
    if (err) {
      logger.error("Optional auth error:", {
        error: err.message,
        requestId: req.id,
      });
      // Don't block request on auth errors for optional auth
      req.user = null;
      return next();
    }

    // Set user if valid, null if invalid (no error thrown)
    req.user = user || null;

    if (!user && info) {
      logger.debug("Optional auth failed:", {
        reason: info.message,
        ip: req.ip,
        requestId: req.id,
      });
    }

    next();
  })(req, res, next);
};

/**
 * Refresh Token Authentication Middleware
 * Used specifically for token refresh endpoints
 */
const refreshTokenAuth = (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      error: "Refresh token required",
    });
  }

  try {
    // Use a different secret for refresh tokens (recommended security practice)
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    const decoded = jwt.verify(refreshToken, secret);

    // Validate refresh token payload
    if (!decoded.userId || decoded.type !== "refresh") {
      throw new Error("Invalid refresh token type");
    }

    // Check if refresh token is not expired (additional safety)
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      throw new Error("Refresh token expired");
    }

    req.userId = decoded.userId;
    req.tokenData = decoded;
    next();
  } catch (error) {
    logger.warn("Refresh token validation failed:", {
      error: error.message,
      ip: req.ip,
      requestId: req.id,
    });

    return res.status(401).json({
      success: false,
      error: "Invalid or expired refresh token",
    });
  }
};

/**
 * Google OAuth Authentication Middleware
 * This is the ONLY place where we use session-based auth
 * Used only for the OAuth callback flow
 */
const googleOAuth = passport.authenticate("google", {
  scope: ["profile", "email"],
  session: true, // Sessions only for OAuth flow
});

const googleOAuthCallback = passport.authenticate("google", {
  failureRedirect: process.env.FRONTEND_URL + "/auth/error",
  session: true, // Sessions only for OAuth flow
});

/**
 * Enhanced token validation for sensitive operations
 * Use this for operations like password changes, account deletion, etc.
 */
const requireFreshToken = (maxAge = 15 * 60 * 1000) => {
  // 15 minutes default
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Invalid token format",
      });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check if token was issued recently
      const tokenAge = Date.now() - decoded.iat * 1000;
      if (tokenAge > maxAge) {
        return res.status(401).json({
          success: false,
          error: "Token too old for this operation",
          requireFreshLogin: true,
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: "Invalid token",
      });
    }
  };
};

/**
 * Rate limiting aware authentication
 * Adds user context to rate limiting
 */
const authenticateWithRateLimit = (req, res, next) => {
  // First authenticate
  authenticateJWT(req, res, (err) => {
    if (err) return next(err);

    // If authenticated, modify rate limit key to be per-user
    // This allows higher rate limits for authenticated users
    if (req.user) {
      req.rateLimitKey = `user:${req.user.id}`;
    }

    next();
  });
};

/**
 * Development-only authentication bypass
 * Useful for testing and development
 */
const devAuth = (req, res, next) => {
  if (process.env.NODE_ENV !== "development") {
    return authenticateJWT(req, res, next);
  }

  // In development, allow bypassing auth with special header
  if (req.headers["x-dev-user-id"]) {
    req.user = {
      id: req.headers["x-dev-user-id"],
      email: "dev@example.com",
      role: req.headers["x-dev-user-role"] || "learner",
      status: "active",
    };
    return next();
  }

  // Otherwise use normal auth
  return authenticateJWT(req, res, next);
};

module.exports = {
  authenticateJWT,
  optionalAuth,
  refreshTokenAuth,
  googleOAuth,
  googleOAuthCallback,
  requireFreshToken,
  authenticateWithRateLimit,
  devAuth,
};
