const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const userModel = require('../models/user.model');
const validator = require('validator');

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = validator.normalizeEmail(profile.emails[0].value);
        const googleId = profile.id;
        const displayName = profile.displayName;
        const avatarUrl = profile.photos[0]?.value;

        let user = await userModel.findByEmail(email);
        console.log('Email:::', email);
        console.log(user);

        if (user) {
          if (!user.google_id)
            user = await userModel.updateGoogleId(user.id, googleId);
          if (!user.display_name)
            user = await userModel.updateDisplayName(user.id, displayName);
          if (!user.avatar_url)
            user = await userModel.updateAvartar(user.id, avatarUrl);
        } else {
          user = await userModel.createGoogleUser({
            email,
            googleId,
            displayName,
            avatarUrl,
            role: 'learner',
          });
        }

        return done(null, {
          id: user.id,
          email: user.email,
          role: user.role,
          displayName: user.display_name,
          avatarUrl: user.avatar_url,
        });
      } catch (error) {
        console.error('Google OAuth Error:', error);
        return done(error, null);
      }
    }
  )
);
