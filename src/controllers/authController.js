const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/database');

class AuthController {
    // Register new user - USC1: Sign up
    async register(req, res) {
        try {
            const { email, password, role = 'learner' } = req.body;
            
            // Check if user exists
            const { data: existingUser } = await supabase
                .from('users')
                .select('id')
                .eq('email', email)
                .single();
                
            if (existingUser) {
                return res.status(400).json({ error: 'Email already registered' });
            }
            
            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);
            
            // Create user
            const { data: newUser, error } = await supabase
                .from('users')
                .insert({
                    email,
                    password: hashedPassword,
                    role,
                    status: role === 'teacher' ? 'pending' : 'active'
                })
                .select()
                .single();
                
            if (error) throw error;
            
            // Generate JWT token
            const token = jwt.sign(
                { userId: newUser.id, email: newUser.email, role: newUser.role },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRE }
            );
            
            res.status(201).json({
                message: 'Registration successful',
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    role: newUser.role
                },
                token
            });
            
        } catch (error) {
            console.error('Register error:', error);
            res.status(500).json({ error: 'Registration failed' });
        }
    }
    
    // Login - USC2: Sign in
    async login(req, res) {
        try {
            const { email, password } = req.body;
            
            // Get user
            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .single();
                
            if (error || !user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            
            // Check password
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            
            // Check if account is active
            if (user.status === 'suspended') {
                return res.status(403).json({ error: 'Account suspended' });
            }
            
            // Generate token
            const token = jwt.sign(
                { userId: user.id, email: user.email, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRE }
            );
            
            // Update last login
            await supabase
                .from('users')
                .update({ last_login: new Date() })
                .eq('id', user.id);
            
            res.json({
                message: 'Login successful',
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    displayName: user.display_name
                },
                token
            });
            
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Login failed' });
        }
    }
    
    // Google OAuth login
    googleLogin(req, res) {
        // Passport đã xử lý, chỉ cần generate JWT
        const user = req.user;
        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
        );
        
        // Redirect về frontend với token
        res.redirect(`${process.env.FRONTEND_URL}/auth/success?token=${token}`);
    }
    
    // Logout - USC3: Sign out
    async logout(req, res) {
        // Với JWT, logout chỉ cần xóa token ở client
        // Có thể implement blacklist token nếu cần
        req.logout((err) => {
            if (err) {
                return res.status(500).json({ error: 'Logout failed' });
            }
            res.json({ message: 'Logout successful' });
        });
    }
    
    // Forgot password
    async forgotPassword(req, res) {
        try {
            const { email } = req.body;
            
            // Check user exists
            const { data: user } = await supabase
                .from('users')
                .select('id')
                .eq('email', email)
                .single();
                
            if (!user) {
                // Không reveal user existence
                return res.json({ message: 'If email exists, reset link has been sent' });
            }
            
            // Generate reset token
            const resetToken = jwt.sign(
                { userId: user.id, type: 'reset' },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );
            
            // Save reset token to database
            await supabase
                .from('password_resets')
                .insert({
                    user_id: user.id,
                    token: resetToken,
                    expires_at: new Date(Date.now() + 3600000) // 1 hour
                });
            
            // TODO: Send email với reset link
            // await emailService.sendResetEmail(email, resetToken);
            
            res.json({ message: 'If email exists, reset link has been sent' });
            
        } catch (error) {
            console.error('Forgot password error:', error);
            res.status(500).json({ error: 'Request failed' });
        }
    }
}

module.exports = new AuthController();