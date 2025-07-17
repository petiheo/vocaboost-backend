const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;
const User = require("../models/User");
const { extendUserModel } = require("../models/UserExtensions");

// Extend User model with additional methods
extendUserModel();

/**
 * JWT Strategy Configuration for Stateless Authentication
 * This is our primary authentication method for API requests
 */
const configureJwtStrategy = () => {
  const options = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET,
    passReqToCallback: false, // We don't need request object for pure JWT
  };

  passport.use(
    "jwt",
    new JwtStrategy(options, async (payload, done) => {
      try {
        // Validate JWT payload structure - this is critical for security
        if (!payload.userId || !payload.email || !payload.role) {
          return done(null, false, {
            message: "Invalid token payload structure",
          });
        }

        // Check token expiration (additional safety check)
        if (payload.exp && Date.now() >= payload.exp * 1000) {
          return done(null, false, { message: "Token expired" });
        }

        // Fetch fresh user data from database
        // This ensures we have up-to-date user status and permissions
        const user = await User.findById(payload.userId);

        if (!user) {
          return done(null, false, { message: "User not found" });
        }

        // Verify user account status - critical security check
        if (user.status !== "active") {
          return done(null, false, {
            message: `Account ${user.status}`,
            accountStatus: user.status,
          });
        }

        // Optional: Update last active timestamp for analytics
        // Note: This creates a database write on every request
        // Consider using a queue or batch updates for high-traffic apps
        if (process.env.TRACK_USER_ACTIVITY === "true") {
          User.update(user.id, { last_active: new Date() }).catch((err) => {
            console.warn("Failed to update last_active:", err.message);
          });
        }

        // Return user object that will be attached to req.user
        return done(null, {
          id: user.id,
          email: user.email,
          role: user.role,
          status: user.status,
          fullName: user.full_name,
          avatarUrl: user.avatar_url,
        });
      } catch (error) {
        console.error("JWT Strategy Error:", error);
        return done(error, false);
      }
    })
  );
};

/**
 * Google OAuth2 Strategy Configuration
 * Note: OAuth requires temporary session storage during the flow
 * After successful OAuth, we generate JWT tokens for subsequent requests
 */
const configureGoogleStrategy = () => {
  // Skip Google OAuth configuration in test environment
  if (process.env.NODE_ENV === "test") {
    console.log("Skipping Google OAuth configuration in test environment");
    return;
  }

  // Validate required environment variables
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn(
      "Google OAuth credentials not configured - Google login will be disabled"
    );
    return;
  }

  const options = {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback",
    scope: ["profile", "email"],
    passReqToCallback: true,
  };

  passport.use(
    "google",
    new GoogleStrategy(
      options,
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          // Validate Google profile data
          if (!profile.emails || !profile.emails[0]) {
            return done(null, false, {
              message: "No email found in Google profile",
            });
          }

          const email = profile.emails[0].value;
          const googleId = profile.id;

          // First, try to find existing user by email
          let user = await User.findByEmail(email);

          // If not found by email, try finding by Google ID
          if (!user && User.findByGoogleId) {
            user = await User.findByGoogleId(googleId);
          }

          if (user) {
            // Existing user found - update Google integration
            if (!user.google_id && user.email === email) {
              await User.update(user.id, {
                google_id: googleId,
                avatar_url: user.avatar_url || profile.photos[0]?.value,
                email_verified: true, // Google emails are pre-verified
              });
            }

            // Check account status before allowing login
            if (user.status !== "active") {
              return done(null, false, {
                message: `Account ${user.status}`,
                accountStatus: user.status,
              });
            }

            // Update login timestamp
            await User.updateLastLogin(user.id);

            // Log successful OAuth login for security monitoring
            await logAuthEvent(user.id, "oauth_login", "google", req);

            return done(null, user);
          }

          // Create new user from Google profile
          const newUserData = {
            email: email,
            full_name:
              profile.displayName ||
              `${profile.name?.givenName || ""} ${
                profile.name?.familyName || ""
              }`.trim() ||
              "User",
            avatar_url: profile.photos[0]?.value || null,
            google_id: googleId,
            role: "learner", // Default role for new users
            status: "active",
            email_verified: true, // Google emails are pre-verified
          };

          const newUser = await User.create(newUserData);

          // Initialize default user data (settings, stats, etc.)
          if (User.initializeUserData) {
            await User.initializeUserData(newUser.id);
          }

          // Log successful OAuth signup
          await logAuthEvent(newUser.id, "oauth_signup", "google", req);

          return done(null, newUser);
        } catch (error) {
          console.error("Google Strategy Error:", error);
          return done(error, false);
        }
      }
    )
  );
};

/**
 * Session serialization for Google OAuth flow only
 * Note: These are ONLY used during the OAuth callback process
 * After OAuth completes, we switch to JWT tokens
 */
const configureOAuthSessions = () => {
  // Minimal serialization - only store user ID
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Minimal deserialization - only fetch essential data
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);

      if (!user) {
        return done(null, false);
      }

      // Return minimal user object for OAuth session
      const sessionUser = {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
      };

      done(null, sessionUser);
    } catch (error) {
      console.error("Deserialize user error:", error);
      done(error, null);
    }
  });
};

/**
 * Helper function to log authentication events
 * This is important for security monitoring and debugging
 */
async function logAuthEvent(userId, eventType, provider, req) {
  try {
    const supabase = require("./database");
    await supabase.from("auth_logs").insert({
      user_id: userId,
      event_type: eventType,
      provider: provider,
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
      created_at: new Date(),
    });
  } catch (error) {
    // Log auth events are not critical - don't throw errors
    console.warn("Failed to log auth event:", error.message);
  }
}

/**
 * Initialize all authentication strategies
 * This function sets up the complete authentication system
 */
const initializeAuthentication = () => {
  // Primary authentication method for API requests
  configureJwtStrategy();

  // OAuth authentication for social login
  configureGoogleStrategy();

  // Session handling only for OAuth flow
  configureOAuthSessions();

  console.log("Authentication strategies initialized:");
  console.log("✅ JWT Strategy (primary)");
  console.log(
    process.env.GOOGLE_CLIENT_ID
      ? "✅ Google OAuth Strategy"
      : "⚠️  Google OAuth disabled"
  );
};

// Initialize strategies when module loads
initializeAuthentication();

module.exports = passport;
