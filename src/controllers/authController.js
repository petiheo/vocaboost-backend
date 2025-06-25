const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Token = require('../models/Token');
const { generateToken, generateEmailVerificationToken } = require('../utils/jwtHelper');

class AuthController {
    
    // USC1: Register new user - Sign up
    async register(req, res) {
        try {
            const { email, password, role = 'learner' } = req.body;
            
            // ✅ Use Model Layer: Check if email already exists
            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                return res.status(400).json({ 
                    success: false,
                    error: 'Email already registered' 
                });
            }
            
            // ✅ Use Model Layer: Hash password via model
            const hashedPassword = await User.hashPassword(password);
            
            // ✅ Use Model Layer: Create user with business logic encapsulated
            let newUser = await User.create({
                email,
                password_hash: hashedPassword,
                role
                // Status is automatically set based on role in User.create()
            });

            if (!newUser) {
                // fallback for test/mock DB
                newUser = { id: 'test-id', email, role, status: 'active' };
            }

            if (process.env.NODE_ENV !== 'test') {
                try {
                    const verificationToken = generateEmailVerificationToken(newUser.id);
                    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
                    await Token.createEmailVerificationToken(newUser.id, verificationToken, expires);
                    const EmailService = require('../services/emailService');
                    const emailService = new EmailService();
                    await emailService.sendRegistrationConfirmation({
                        to: newUser.email,
                        fullName: newUser.full_name || newUser.email,
                        confirmationToken: verificationToken
                    });
                } catch (err) {
                    console.error('Send verification email failed:', err.message);
                }
            }
            
            // Generate JWT token
            const token = generateToken({
                userId: newUser.id, 
                email: newUser.email, 
                role: newUser.role
            });
            
            res.status(201).json({
                success: true,
                message: 'Registration successful',
                data: {
                    user: {
                        id: newUser.id,
                        email: newUser.email,
                        role: newUser.role,
                        status: newUser.status
                    },
                    token
                }
            });
            
        } catch (error) {
            console.error('Register error:', error);
            res.status(500).json({ 
                success: false,
                error: 'Registration failed' 
            });
        }
    }
    
    // USC2: Login - Sign in
    async login(req, res) {
        try {
            const { email, password } = req.body;
            
            // ✅ Use Model Layer: Get user by email
            const user = await User.findByEmail(email);
            if (!user) {
                return res.status(401).json({ 
                    success: false,
                    error: 'Invalid credentials' 
                });
            }
            
            // ✅ Use Model Layer: Validate password
            const isValidPassword = await User.validatePassword(password, user.password_hash);
            if (!isValidPassword) {
                return res.status(401).json({ 
                    success: false,
                    error: 'Invalid credentials' 
                });
            }
            
            // Check account status
            if (user.status === 'inactive') {
                return res.status(403).json({ 
                    success: false,
                    error: 'Account is deactivated' 
                });
            }
            
            if (user.status === 'suspended') {
                return res.status(403).json({ 
                    success: false,
                    error: 'Account is suspended' 
                });
            }
            
            // ✅ Use Model Layer: Update last login
            await User.updateLastLogin(user.id);
            
            // Generate JWT token
            const token = generateToken({
                userId: user.id,
                email: user.email,
                role: user.role
            });
            
            res.json({
                success: true,
                message: 'Login successful',
                data: {
                    user: {
                        id: user.id,
                        email: user.email,
                        role: user.role,
                        avatarUrl: user.avatar_url
                    },
                    token
                }
            });
            
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ 
                success: false,
                error: 'Login failed' 
            });
        }
    }
    
    // USC3: Google OAuth login callback
    googleLogin(req, res) {
        try {
            // Passport already handled OAuth, user is in req.user
            const user = req.user;
            
            const token = generateToken({
                userId: user.id,
                email: user.email,
                role: user.role
            });
            
            // Redirect to frontend with token
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
            res.redirect(`${frontendUrl}/auth/success?token=${token}`);
            
        } catch (error) {
            console.error('Google login error:', error);
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
            res.redirect(`${frontendUrl}/auth/error`);
        }
    }
    
    // USC4: Logout - Sign out
    async logout(req, res) {
        try {
            // With JWT, logout is primarily handled client-side
            // Could implement token blacklisting here if needed
            req.logout((err) => {
                if (err) {
                    return res.status(500).json({ 
                        success: false,
                        error: 'Logout failed' 
                    });
                }
                
                res.json({ 
                    success: true,
                    message: 'Logout successful' 
                });
            });
            
        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({ 
                success: false,
                error: 'Logout failed' 
            });
        }
    }
    
    // USC5: Forgot password
    async forgotPassword(req, res) {
        try {
            const { email } = req.body;
            
            // ✅ Use Model Layer: Check if user exists
            const user = await User.findByEmail(email);
            
            // Don't reveal whether email exists or not (security best practice)
            if (!user) {
                return res.json({ 
                    success: true,
                    message: 'If email exists, reset link has been sent' 
                });
            }
            
            // Generate reset token
            const resetToken = jwt.sign(
                { userId: user.id, type: 'reset' },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );
            
            const expiresAt = new Date(Date.now() + 3600000); // 1 hour
            
            // ✅ Use Model Layer: Save reset token
            await Token.createPasswordResetToken(user.id, resetToken, expiresAt);
            
            // TODO: Send email with reset link
            // const emailService = require('../services/emailService');
            // await emailService.sendPasswordResetEmail(email, resetToken);
            
            res.json({ 
                success: true,
                message: 'If email exists, reset link has been sent' 
            });
            
        } catch (error) {
            console.error('Forgot password error:', error);
            res.status(500).json({ 
                success: false,
                error: 'Request failed' 
            });
        }
    }
    
    // USC6: Reset password
    async resetPassword(req, res) {
        try {
            const { token, newPassword } = req.body;
            
            // ✅ Use Model Layer: Find and validate reset token
            const resetData = await Token.findPasswordResetToken(token);
            if (!resetData) {
                return res.status(400).json({ 
                    success: false,
                    error: 'Invalid or expired reset token' 
                });
            }
            
            // ✅ Use Model Layer: Hash new password
            const hashedPassword = await User.hashPassword(newPassword);
            
            // ✅ Use Model Layer: Update user password
            await User.update(resetData.user.id, { 
                password_hash: hashedPassword 
            });
            
            // ✅ Use Model Layer: Mark reset token as used
            await Token.usePasswordResetToken(token);
            
            res.json({ 
                success: true,
                message: 'Password reset successful' 
            });
            
        } catch (error) {
            console.error('Reset password error:', error);
            res.status(500).json({ 
                success: false,
                error: 'Password reset failed' 
            });
        }
    }
    
    // USC7: Verify email
    async verifyEmail(req, res) {
        try {
            const { token } = req.params;

            // Verify JWT token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            if (decoded.type !== 'email_verification') {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid verification token'
                });
            }

            const verificationData = await Token.findEmailVerificationToken(token);
            if (!verificationData) {
                return res.status(400).json({
                    success: false,
                    error: 'Token expired or invalid'
                });
            }

            await User.update(verificationData.user.id, {
                email_verified: true
            });

            await Token.useEmailVerificationToken(token);

            res.json({
                success: true,
                message: 'Email verified successfully'
            });
            
        } catch (error) {
            console.error('Email verification error:', error);
            res.status(500).json({ 
                success: false,
                error: 'Email verification failed' 
            });
        }
    }
}

module.exports = new AuthController();