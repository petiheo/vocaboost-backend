const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const User = require('../models/User');
const { extendUserModel } = require('../models/UserExtensions');
extendUserModel();

/**
 * JWT Strategy Configuration
 * Verify JWT tokens from Authorization header
 */
const configureJwtStrategy = () => {
  const options = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET,
    passReqToCallback: true
  };

  passport.use('jwt', new JwtStrategy(options, async (req, payload, done) => {
    try {
      // Validate JWT payload structure
      if (!payload.userId || !payload.email) {
        return done(null, false, { message: 'Invalid token payload' });
      }

      // Get user from database using Model
      const user = await User.findById(payload.userId);
      
      if (!user) {
        return done(null, false, { message: 'User not found' });
      }

      // Check account status
      if (user.status === 'suspended' || user.status === 'banned') {
        return done(null, false, { message: `Account ${user.status}` });
      }

      if (user.status !== 'active') {
        return done(null, false, { message: 'Account not active' });
      }

      // Update last active timestamp
      await User.update(user.id, { last_active: new Date() });

      // Attach user to request
      req.user = user;
      return done(null, user);
    } catch (error) {
      console.error('JWT Strategy Error:', error);
      return done(error, false);
    }
  }));
};

/**
 * Google OAuth2 Strategy Configuration
 */
const configureGoogleStrategy = () => {
  // Skip Google OAuth in test environment
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  // Check required environment variables
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn('Google OAuth credentials not configured');
    return;
  }

  const options = {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
    scope: ['profile', 'email'],
    passReqToCallback: true
  };

  passport.use('google', new GoogleStrategy(options, async (req, accessToken, refreshToken, profile, done) => {
    try {
      // Validate Google profile data
      if (!profile.emails || !profile.emails[0]) {
        return done(null, false, { message: 'No email found in Google profile' });
      }

      const email = profile.emails[0].value;
      const googleId = profile.id;

      // Find existing user by email first, then by Google ID
      let user = await User.findByEmail(email);
      
      // If not found by email, try finding by Google ID if method exists
      if (!user && User.findByGoogleId) {
        user = await User.findByGoogleId(googleId);
      }

      if (user) {
        // Update Google ID if not set
        if (!user.google_id && user.email === email) {
          await User.update(user.id, {
            google_id: googleId,
            avatar_url: user.avatar_url || profile.photos[0]?.value
          });
        }

        // Check account status
        if (user.status === 'suspended' || user.status === 'banned') {
          return done(null, false, { message: `Account ${user.status}` });
        }

        // Update login timestamps
        await User.updateLastLogin(user.id);
        
        // Log authentication event (if auth_logs table exists)
        try {
          const supabase = require('./database');
          await supabase
            .from('auth_logs')
            .insert({
              user_id: user.id,
              event_type: 'login',
              provider: 'google',
              ip_address: req.ip,
              user_agent: req.headers['user-agent'],
              created_at: new Date()
            });
        } catch (logError) {
          console.error('Failed to log auth event:', logError.message);
        }

        return done(null, user);
      }

      // Create new user
      const newUserData = {
        email: email,
        full_name: profile.displayName || `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim() || 'User',
        avatar_url: profile.photos[0]?.value || null,
        google_id: googleId,
        role: 'learner', // Default role
        status: 'active',
        email_verified: true // Google emails are pre-verified
      };

      const newUser = await User.create(newUserData);

      // Initialize default user data if method exists
      if (User.initializeUserData) {
        await User.initializeUserData(newUser.id);
      }

      // Log signup event (if auth_logs table exists)
      try {
        const supabase = require('./database');
        await supabase
          .from('auth_logs')
          .insert({
            user_id: newUser.id,
            event_type: 'signup',
            provider: 'google',
            ip_address: req.ip,
            user_agent: req.headers['user-agent'],
            created_at: new Date()
          });
      } catch (logError) {
        console.error('Failed to log signup event:', logError.message);
      }

      return done(null, newUser);
    } catch (error) {
      console.error('Google Strategy Error:', error);
      return done(error, false);
    }
  }));
};

/**
 * Serialize user for session
 * Only store user ID in session to minimize session size
 */
passport.serializeUser((user, done) => {
  done(null, user.id);
});

/**
 * Deserialize user from session
 * Fetch full user data from database
 */
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    
    if (!user) {
      return done(null, false);
    }

    // Only return essential user data
    const sessionUser = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      role: user.role,
      status: user.status
    };

    done(null, sessionUser);
  } catch (error) {
    console.error('Deserialize user error:', error);
    done(error, null);
  }
});

/**
 * Initialize all Passport strategies
 */
const initializePassport = () => {
  configureJwtStrategy();
  configureGoogleStrategy();
};

// Initialize strategies when module loads
initializePassport();

module.exports = passport;