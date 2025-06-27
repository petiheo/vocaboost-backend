// controllers/authController.js (REFACTORED)
const AuthService = require('../models/business-logic/core/AuthService');
const AuthSchema = require('../models/schemas/auth/AuthSchema');

class AuthController {
    constructor() {
        this.authService = new AuthService();
    }

    // USC1: Register new user - Sign up
    async register(req, res) {
        try {
            const userData = {
                email: req.body.email,
                password: req.body.password,
                role: req.body.role || 'learner',
                fullName: req.body.fullName
            };

            // Delegate business logic to AuthService
            const result = await this.authService.registerUser(userData);

            res.status(201).json({
                success: true,
                message: 'Registration successful',
                data: result
            });

        } catch (error) {
            console.error('Register error:', error);
            
            if (error.message === 'Email already registered') {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }

            res.status(500).json({
                success: false,
                error: 'Registration failed'
            });
        }
    }

    // USC2: Login - Sign in
    async login(req, res) {
        try {
            const credentials = {
                email: req.body.email,
                password: req.body.password
            };

            // Delegate business logic to AuthService
            const result = await this.authService.loginUser(credentials);

            res.json({
                success: true,
                message: 'Login successful',
                data: result
            });

        } catch (error) {
            console.error('Login error:', error);

            // Handle failed login tracking
            if (error.message === 'Invalid credentials') {
                try {
                    await this.authService.handleFailedLogin(
                        req.body.email,
                        req.ip
                    );
                } catch (rateLimitError) {
                    return res.status(429).json({
                        success: false,
                        error: rateLimitError.message
                    });
                }

                return res.status(401).json({
                    success: false,
                    error: 'Invalid credentials'
                });
            }

            if (error.message.includes('Account is')) {
                return res.status(403).json({
                    success: false,
                    error: error.message
                });
            }

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

            // Generate JWT token using AuthService logic
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
            // Invalidate session if sessionId is provided
            if (req.body.sessionId) {
                await this.authService.invalidateSession(req.body.sessionId);
            }

            // If logout from all devices
            if (req.body.logoutAll && req.user) {
                await this.authService.invalidateAllUserSessions(req.user.id);
            }

            res.json({
                success: true,
                message: 'Logout successful'
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

            // Delegate to AuthService for business logic
            const result = await this.authService.initiatePasswordReset(email);

            res.json({
                success: true,
                message: result.message
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

            // Delegate to AuthService for business logic
            const result = await this.authService.completePasswordReset(token, newPassword);

            res.json({
                success: true,
                message: result.message
            });

        } catch (error) {
            console.error('Reset password error:', error);

            if (error.message === 'Invalid or expired reset token') {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }

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

            // Delegate to AuthService for business logic
            const result = await this.authService.verifyEmail(token);

            res.json({
                success: true,
                message: result.message
            });

        } catch (error) {
            console.error('Email verification error:', error);

            if (error.message === 'Token expired or invalid') {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }

            res.status(500).json({
                success: false,
                error: 'Email verification failed'
            });
        }
    }

    // Resend verification email
    async resendVerificationEmail(req, res) {
        try {
            const userId = req.user.id;

            // Delegate to AuthService for business logic
            const result = await this.authService.resendVerificationEmail(userId);

            res.json({
                success: true,
                message: result.message
            });

        } catch (error) {
            console.error('Resend verification error:', error);

            if (error.message.includes('already verified') || 
                error.message.includes('already sent recently')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }

            res.status(500).json({
                success: false,
                error: 'Failed to resend verification email'
            });
        }
    }

    // Check account lockout status
    async checkAccountStatus(req, res) {
        try {
            const { email } = req.query;

            // Delegate to AuthService for business logic
            const lockoutStatus = await this.authService.checkAccountLockout(email);

            res.json({
                success: true,
                data: lockoutStatus
            });

        } catch (error) {
            console.error('Check account status error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to check account status'
            });
        }
    }

    // Create session (for device tracking)
    async createSession(req, res) {
        try {
            const userId = req.user.id;
            const deviceInfo = {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                deviceName: req.body.deviceName,
                platform: req.body.platform
            };

            // Delegate to AuthService for business logic
            const session = await this.authService.createSession(userId, deviceInfo);

            res.json({
                success: true,
                data: {
                    sessionId: session.id,
                    expiresAt: session.expires_at
                }
            });

        } catch (error) {
            console.error('Create session error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create session'
            });
        }
    }

    // Get validation schemas for routes
    static getValidationSchemas() {
        return {
            register: AuthSchema.registerSchema(),
            login: AuthSchema.loginSchema(),
            forgotPassword: AuthSchema.forgotPasswordSchema(),
            resetPassword: AuthSchema.resetPasswordSchema(),
            verifyEmail: AuthSchema.emailVerificationSchema(),
            changePassword: AuthSchema.changePasswordSchema(),
            oauthCallback: AuthSchema.oauthCallbackSchema(),
            refreshToken: AuthSchema.refreshTokenSchema()
        };
    }
}

module.exports = new AuthController();