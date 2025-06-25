const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const supabase = require('./database');

// JWT Strategy - để verify JWT tokens
passport.use(new JwtStrategy({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET || 'test-secret'
}, async (payload, done) => {
    try {
        // Tìm user trong database
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', payload.userId)
            .single();

        if (error || !user) {
            return done(null, false);
        }

        // Kiểm tra user status
        if (user.status === 'suspended') {
            return done(null, false, { message: 'Account suspended' });
        }

        return done(null, user);
    } catch (error) {
        return done(error, false);
    }
}));

// Google OAuth Strategy
if (process.env.NODE_ENV !== 'test' && process.env.GOOGLE_CLIENT_ID) {
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Kiểm tra user đã tồn tại chưa
        const { data: existingUser } = await supabase
            .from('users')
            .select('*')
            .eq('email', profile.emails[0].value)
            .single();

        if (existingUser) {
            return done(null, existingUser);
        }

        // Tạo user mới nếu chưa tồn tại
        const { data: newUser, error } = await supabase
            .from('users')
            .insert({
                email: profile.emails[0].value,
                display_name: profile.displayName,
                avatar_url: profile.photos[0].value,
                google_id: profile.id,
                role: 'learner',
                status: 'active'
            })
            .select()
            .single();

        if (error) throw error;

        return done(null, newUser);
    } catch (error) {
        return done(error, false);
    }
}));
}

// Serialize/Deserialize user cho session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .single();
        
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});