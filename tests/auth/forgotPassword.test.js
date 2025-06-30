// tests/auth/forgotPassword.test.js
const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Token = require('../../src/models/Token');
const EmailService = require('../../src/services/emailService');

// Mock dependencies
jest.mock('../../src/models/User');
jest.mock('../../src/models/Token');
jest.mock('../../src/services/emailService');

describe('Forgot Password Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should send reset email for valid user', async () => {
      // Mock user exists
      User.findByEmail.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        full_name: 'Test User',
        password_hash: 'hashed_password'
      });

      // Mock token creation
      Token.createPasswordResetToken.mockResolvedValue({
        id: 'token-123',
        token: 'reset-token',
        user_id: 'user-123'
      });

      // Mock email service
      const mockSendPasswordReset = jest.fn().mockResolvedValue({ success: true });
      EmailService.mockImplementation(() => ({
        sendPasswordReset: mockSendPasswordReset
      }));

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'If the email exists in our system, we have sent password reset instructions.'
      });

      expect(User.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(Token.createPasswordResetToken).toHaveBeenCalled();
      expect(mockSendPasswordReset).toHaveBeenCalledWith({
        to: 'test@example.com',
        fullName: 'Test User',
        resetToken: expect.any(String)
      });
    });

    it('should return success even for non-existent email', async () => {
      // Mock user doesn't exist
      User.findByEmail.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'If the email exists in our system, we have sent password reset instructions.'
      });

      expect(Token.createPasswordResetToken).not.toHaveBeenCalled();
    });

    it('should send OAuth notification for Google users', async () => {
      // Mock OAuth user
      User.findByEmail.mockResolvedValue({
        id: 'user-123',
        email: 'oauth@example.com',
        full_name: 'OAuth User',
        password_hash: null,
        google_id: 'google-123'
      });

      const mockSendOAuthNotification = jest.fn().mockResolvedValue({ success: true });
      EmailService.mockImplementation(() => ({
        sendOAuthAccountNotification: mockSendOAuthNotification
      }));

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'oauth@example.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockSendOAuthNotification).toHaveBeenCalled();
      expect(Token.createPasswordResetToken).not.toHaveBeenCalled();
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyLTEyMyIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInR5cGUiOiJwYXNzd29yZF9yZXNldCIsImlhdCI6MTYwOTQ1OTIwMCwiZXhwIjo5OTk5OTk5OTk5fQ.fake-signature';

    beforeEach(() => {
      // Mock JWT verification
      process.env.JWT_SECRET = 'test-secret';
    });

    it('should reset password with valid token', async () => {
      // Mock token validation
      Token.findPasswordResetToken.mockResolvedValue({
        id: 'token-123',
        token: validToken,
        user_id: 'user-123',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          full_name: 'Test User'
        }
      });

      // Mock password hashing
      User.hashPassword.mockResolvedValue('new_hashed_password');
      User.update.mockResolvedValue({ success: true });
      Token.usePasswordResetToken.mockResolvedValue(true);

      // Mock email service
      const mockSendConfirmation = jest.fn().mockResolvedValue({ success: true });
      EmailService.mockImplementation(() => ({
        sendPasswordChangeConfirmation: mockSendConfirmation
      }));

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: validToken,
          newPassword: 'NewSecurePass123'
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Password has been reset successfully. Please login with your new password.'
      });

      expect(User.hashPassword).toHaveBeenCalledWith('NewSecurePass123');
      expect(User.update).toHaveBeenCalledWith('user-123', {
        password_hash: 'new_hashed_password',
        password_changed_at: expect.any(Date)
      });
      expect(Token.usePasswordResetToken).toHaveBeenCalledWith(validToken);
    });

    it('should reject weak passwords', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: validToken,
          newPassword: 'weak'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.details[0].message).toContain('at least 8 characters');
    });

    it('should reject passwords without uppercase/lowercase/number', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: validToken,
          newPassword: 'alllowercase'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.details[0].message).toContain('uppercase, lowercase and number');
    });

    it('should reject expired tokens', async () => {
      // Mock token not found (expired)
      Token.findPasswordResetToken.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'expired-token',
          newPassword: 'NewSecurePass123'
        })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Token has been used or expired'
      });
    });

    it('should reject missing token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          newPassword: 'NewSecurePass123'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/resend-verification', () => {
    it('should resend verification email', async () => {
      User.findByEmail.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        full_name: 'Test User',
        email_verified: false
      });

      Token.createEmailVerificationToken.mockResolvedValue({
        id: 'token-123',
        token: 'verify-token'
      });

      const mockSendRegistration = jest.fn().mockResolvedValue({ success: true });
      EmailService.mockImplementation(() => ({
        sendRegistrationConfirmation: mockSendRegistration
      }));

      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Verification email has been resent'
      });

      expect(mockSendRegistration).toHaveBeenCalled();
    });

    it('should reject already verified emails', async () => {
      User.findByEmail.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        email_verified: true
      });

      const response = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'test@example.com' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Email already verified'
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit forgot password requests', async () => {
      User.findByEmail.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com'
      });

      // Make 5 requests (the limit)
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/forgot-password')
          .send({ email: 'test@example.com' })
          .expect(200);
      }

      // 6th request should be rate limited
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' })
        .expect(429);

      expect(response.body.error).toContain('Rate limit exceeded');
    });
  });
});

// Integration test example
describe('Forgot Password Flow - Integration', () => {
  it('complete flow from forgot to reset', async () => {
    // This would be an actual integration test with real DB
    // Showing the flow structure here
    
    // 1. Request password reset
    const forgotResponse = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'integration@test.com' });
    
    expect(forgotResponse.status).toBe(200);
    
    // 2. In real test, extract token from email or DB
    // const resetToken = extractTokenFromEmail();
    
    // 3. Reset password with token
    // const resetResponse = await request(app)
    //   .post('/api/auth/reset-password')
    //   .send({
    //     token: resetToken,
    //     newPassword: 'NewPassword123'
    //   });
    
    // expect(resetResponse.status).toBe(200);
    
    // 4. Try login with new password
    // const loginResponse = await request(app)
    //   .post('/api/auth/login')
    //   .send({
    //     email: 'integration@test.com',
    //     password: 'NewPassword123'
    //   });
    
    // expect(loginResponse.status).toBe(200);
    // expect(loginResponse.body.data.token).toBeDefined();
  });
});