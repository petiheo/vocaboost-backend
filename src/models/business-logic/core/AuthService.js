// models/business-logic/core/AuthService.js
const UserRepository = require('../../repositories/auth/UserRepository');
const TokenRepository = require('../../repositories/auth/TokenRepository');
const EmailService = require('../integrations/EmailService');
const CacheService = require('../integrations/CacheService');
const { generateToken, generateEmailVerificationToken } = require('../../../utils/jwtHelper');

class AuthService {
    constructor() {
        this.userRepository = new UserRepository();
        this.tokenRepository = new TokenRepository();
        this.emailService = new EmailService();
        this.cacheService = new CacheService();
    }

    // Business logic for user registration
    async registerUser(userData) {
        const { email, password, role = 'learner' } = userData;

        // Business rule: Check email availability
        const isEmailAvailable = await this.userRepository.isEmailAvailable(email);
        if (!isEmailAvailable) {
            throw new Error('Email already registered');
        }

        // Business rule: Hash password
        const hashedPassword = await this.userRepository.hashPassword(password);

        // Business rule: Create user with proper status
        const newUser = await this.userRepository.createUser({
            email,
            password_hash: hashedPassword,
            role,
            full_name: userData.fullName
        });

        // Business rule: Generate verification token and send email
        if (process.env.NODE_ENV !== 'test') {
            try {
                const verificationToken = generateEmailVerificationToken(newUser.id);
                const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
                
                await this.tokenRepository.createEmailVerificationToken(
                    newUser.id, 
                    verificationToken, 
                    expires
                );

                await this.emailService.sendRegistrationConfirmation({
                    to: newUser.email,
                    fullName: newUser.full_name || newUser.email,
                    confirmationToken: verificationToken
                });
            } catch (emailError) {
                console.error('Failed to send verification email:', emailError.message);
                // Don't fail registration if email fails
            }
        }

        // Business rule: Generate JWT token for immediate login
        const token = generateToken({
            userId: newUser.id,
            email: newUser.email,
            role: newUser.role
        });

        return {
            user: {
                id: newUser.id,
                email: newUser.email,
                role: newUser.role,
                status: newUser.status,
                emailVerified: newUser.email_verified
            },
            token
        };
    }

    // Business logic for user login
    async loginUser(credentials) {
        const { email, password } = credentials;

        // Business rule: Find user by email
        const user = await this.userRepository.findByEmail(email);
        if (!user) {
            throw new Error('Invalid credentials');
        }

        // Business rule: Validate password
        const isValidPassword = await this.userRepository.validatePassword(password, user.password_hash);
        if (!isValidPassword) {
            throw new Error('Invalid credentials');
        }

        // Business rule: Check account status
        if (user.status === 'inactive') {
            throw new Error('Account is deactivated');
        }

        if (user.status === 'suspended') {
            throw new Error('Account is suspended');
        }

        // Business rule: Update last login timestamp
        await this.userRepository.updateLastLogin(user.id);

        // Business rule: Clear any existing rate limit for successful login
        await this.cacheService.del(`failed_login:${email}`);

        // Business rule: Generate JWT token
        const token = generateToken({
            userId: user.id,
            email: user.email,
            role: user.role
        });

        return {
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                status: user.status,
                avatarUrl: user.avatar_url,
                emailVerified: user.email_verified
            },
            token
        };
    }

    // Business logic for failed login tracking
    async handleFailedLogin(email, ip) {
        const failedKey = `failed_login:${email}`;
        const ipKey = `failed_login_ip:${ip}`;

        // Increment failed attempts
        const emailAttempts = await this.cacheService.incr(failedKey, 3600); // 1 hour TTL
        const ipAttempts = await this.cacheService.incr(ipKey, 3600);

        // Business rule: Lock account after 5 failed attempts from email
        if (emailAttempts >= 5) {
            // Temporarily suspend account
            const user = await this.userRepository.findByEmail(email);
            if (user && user.status === 'active') {
                await this.userRepository.update(user.id, {
                    status: 'suspended',
                    suspension_reason: 'Too many failed login attempts',
                    suspension_expires: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
                });

                // Send security alert email
                await this.emailService.sendSecurityAlert({
                    to: email,
                    reason: 'Multiple failed login attempts detected'
                });
            }
        }

        // Business rule: Rate limit by IP after 10 attempts
        if (ipAttempts >= 10) {
            throw new Error('Too many failed attempts from this IP address');
        }

        return {
            emailAttempts,
            ipAttempts,
            isLocked: emailAttempts >= 5
        };
    }

    // Business logic for password reset
    async initiatePasswordReset(email) {
        // Business rule: Check if user exists (don't reveal this for security)
        const user = await this.userRepository.findByEmail(email);
        
        if (user) {
            // Business rule: Generate reset token
            const resetToken = generateToken(
                { userId: user.id, type: 'reset' },
                '1h' // 1 hour expiry
            );

            const expiresAt = new Date(Date.now() + 3600000); // 1 hour

            // Business rule: Save reset token
            await this.tokenRepository.createPasswordResetToken(
                user.id, 
                resetToken, 
                expiresAt
            );

            // Business rule: Send reset email
            await this.emailService.sendPasswordReset({
                to: email,
                fullName: user.full_name || email,
                resetToken: resetToken
            });
        }

        // Always return success (don't reveal if email exists)
        return {
            message: 'If email exists, reset link has been sent'
        };
    }

    // Business logic for password reset completion
    async completePasswordReset(token, newPassword) {
        // Business rule: Validate reset token
        const resetData = await this.tokenRepository.findPasswordResetToken(token);
        if (!resetData) {
            throw new Error('Invalid or expired reset token');
        }

        // Business rule: Hash new password
        const hashedPassword = await this.userRepository.hashPassword(newPassword);

        // Business rule: Update user password
        await this.userRepository.update(resetData.user.id, {
            password_hash: hashedPassword
        });

        // Business rule: Mark token as used
        await this.tokenRepository.usePasswordResetToken(token);

        // Business rule: Clear any failed login attempts
        await this.cacheService.del(`failed_login:${resetData.user.email}`);

        return {
            message: 'Password reset successful'
        };
    }

    // Business logic for email verification
    async verifyEmail(token) {
        // Business rule: Validate verification token
        const verificationData = await this.tokenRepository.findEmailVerificationToken(token);
        if (!verificationData) {
            throw new Error('Token expired or invalid');
        }

        // Business rule: Mark email as verified
        await this.userRepository.update(verificationData.user.id, {
            email_verified: true
        });

        // Business rule: Mark token as used
        await this.tokenRepository.useEmailVerificationToken(token);

        return {
            message: 'Email verified successfully'
        };
    }

    // Business logic for resending verification email
    async resendVerificationEmail(userId) {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        if (user.email_verified) {
            throw new Error('Email already verified');
        }

        // Business rule: Check if recent verification email was sent
        const recentEmailKey = `verification_sent:${userId}`;
        const recentlySent = await this.cacheService.get(recentEmailKey);
        
        if (recentlySent) {
            throw new Error('Verification email already sent recently. Please wait before requesting again.');
        }

        // Business rule: Generate new verification token
        const verificationToken = generateEmailVerificationToken(user.id);
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await this.tokenRepository.createEmailVerificationToken(
            user.id,
            verificationToken,
            expires
        );

        // Business rule: Send verification email
        await this.emailService.sendRegistrationConfirmation({
            to: user.email,
            fullName: user.full_name || user.email,
            confirmationToken: verificationToken
        });

        // Business rule: Set cooldown to prevent spam
        await this.cacheService.set(recentEmailKey, true, 300); // 5 minutes cooldown

        return {
            message: 'Verification email sent'
        };
    }

    // Business logic for account lockout check
    async checkAccountLockout(email) {
        const user = await this.userRepository.findByEmail(email);
        if (!user) {
            return { isLocked: false };
        }

        // Check if account is temporarily suspended due to failed logins
        if (user.status === 'suspended' && user.suspension_expires) {
            const now = new Date();
            const expiryDate = new Date(user.suspension_expires);

            if (now < expiryDate) {
                return {
                    isLocked: true,
                    reason: user.suspension_reason,
                    expiresAt: expiryDate
                };
            } else {
                // Auto-unlock expired suspension
                await this.userRepository.update(user.id, {
                    status: 'active',
                    suspension_reason: null,
                    suspension_expires: null
                });
            }
        }

        return { isLocked: false };
    }

    // Business logic for session management
    async createSession(userId, deviceInfo) {
        const sessionData = {
            user_id: userId,
            device_info: deviceInfo,
            ip_address: deviceInfo.ip,
            user_agent: deviceInfo.userAgent,
            created_at: new Date(),
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        };

        return await this.tokenRepository.createSession(sessionData);
    }

    async invalidateSession(sessionId) {
        return await this.tokenRepository.deleteSession(sessionId);
    }

    async invalidateAllUserSessions(userId) {
        return await this.tokenRepository.deleteUserSessions(userId);
    }
}

module.exports = AuthService;