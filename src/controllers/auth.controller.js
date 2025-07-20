const authService = require('../services/auth.service');
const {
  generateToken,
  generateEmailVerificationToken,
  generateResetToken,
  verifyToken,
} = require('../helpers/jwt.helper');
const emailService = require('../services/email.service');
const passport = require('passport');

class AuthController {
  // TODO: Render HTML bằng Pug, chuyển logic chính sang service
  async register(req, res) {
    try {
      const { email, password, role = 'learner' } = req.body;

      const isExistEmail = await authService.findUserByEmail(email);
      if (isExistEmail) {
        return res.status(409).json({
          success: false,
          message: 'Email already registered',
        });
      }

      const userData = await authService.insertIntoUsers(email, password, role);
      const verificationToken = generateEmailVerificationToken(userData.id);
      await authService.insertIntoAuthTokens(
        verificationToken,
        userData.id,
        `email_verification`,
        '24h'
      );
      await emailService.sendEmailVerification(email, verificationToken);

      const accessToken = generateToken({
        userId: userData.id,
        email,
        role,
      });

      return res.status(201).json({
        success: true,
        message:
          'Registration successful. Please check your email for verification.',
        data: {
          user: {
            id: userData.id,
            email,
            role,
            status: userData.account_status,
          },
          token: accessToken,
        },
      });
    } catch (error) {
      console.error('Register error: ', error);
      return res.status(400).json({
        success: false,
        message: 'Registration failed',
      });
    }
  }

  // TODO: Chuyển logic chính sang service, thêm login attemp (optional), update last login
  async login(req, res) {
    try {
      const { email, password } = req.body;

      const userData = await authService.findUserByEmail(email);
      if (!userData) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password',
        });
      }

      const isValidPassword = await authService.validatePassword(
        password,
        userData.password_hash
      );
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password',
        });
      }

      if (userData.account_status === 'inactive') {
        return res.status(403).json({
          success: false,
          error: 'Account has been deactivated',
        });
      }

      if (userData.account_status === 'suspended') {
        return res.status(403).json({
          success: false,
          error: 'Account has been suspended',
        });
      }

      const accessToken = generateToken({
        userId: userData.id,
        email,
        role: userData.role,
      });

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: userData.id,
            email,
            role: userData.role,
            avataUrl: userData.avatar_url,
          },
          token: accessToken,
        },
      });
    } catch (error) {
      console.error('Login error: ', error);
      return res.status(400).json({
        success: false,
        message: 'Login failed',
      });
    }
  }

  async googleCallback(req, res, next) {
    passport.authenticate(
      'google',
      { session: false },
      async (err, user, info) => {
        const frontendUrl = process.env.FRONTEND_URL;
        try {
          if (err) {
            console.error('Google OAuth Error:', err);
            return res.redirect(`${frontendUrl}/login?error=oauth_failed`);
          }

          if (!user) {
            return res.redirect(`${frontendUrl}/login?error=access_denied`);
          }

          const accessToken = generateToken({
            userId: user.id,
            email: user.email,
            role: user.role,
          });
          res.redirect(`${frontendUrl}/auth/success?token=${accessToken}`);
        } catch (error) {
          console.error('Google callback processing error:', error);
          res.redirect(`${frontendUrl}/login?error=processing_failed`);
        }
      }
    )(req, res, next);
  }

  // TODO: frontend sẽ xử lý xóa JWT, sau này có thể triển khai thêm blacklist token
  async logout(req, res) {
    try {
      return res.status(200).json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error) {
      console.error('Logout error: ', error);
      return res.status(400).json({
        success: false,
        message: 'Logout failed',
      });
    }
  }

  // TODO: chú ý trường hợp xử lý tài khoản Google sau này
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      const userData = await authService.findUserByEmail(email);
      if (!userData) {
        return res.status(200).json({
          success: true,
          message:
            'If the email exists, password reset instructions have been sent',
        });
      }

      const resetToken = generateResetToken(userData.id);
      await authService.insertIntoAuthTokens(
        resetToken,
        userData.id,
        'password_reset',
        '15m'
      );
      await emailService.sendPasswordReset(email, resetToken);

      return res.status(200).json({
        success: true,
        message:
          'If the email exists, password reset instructions have been sent',
      });
    } catch (error) {
      console.error('Forgot password error: ', error);
      return res.status(400).json({
        success: false,
        message: 'Forgot password failed',
      });
    }
  }

  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;
      const decoded = verifyToken(token);

      if (
        decoded.type !== 'password_reset' ||
        (await authService.isUsedToken(token))
      ) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired token',
        });
      }

      await authService.updateUsedAt(token);
      await authService.updatePassword(decoded.userId, newPassword);
      return res.status(200).json({
        success: true,
        message:
          'Password has been reset successfully. Please login with your new password.',
      });
    } catch (error) {
      console.error('Reset password error: ', error);
      return res.status(400).json({
        success: false,
        message: 'Reset password failed',
      });
    }
  }

  async verifyEmail(req, res) {
    try {
      const token = req.params.token;
      const decoded = verifyToken(token);

      if (
        decoded.type !== 'email_verification' ||
        (await authService.isUsedToken(token))
      ) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired token',
        });
      }

      await authService.updateUsedAt(token);
      await authService.verifyEmail(decoded.userId);
      return res.status(200).json({
        success: true,
        message: 'Email verified successfully.',
      });
    } catch (error) {
      console.error('Verify email error: ', error);
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token',
      });
    }
  }

  async resendVerification(req, res) {
    try {
      const { email } = req.body;
      const userData = await authService.findUserByEmail(email);

      if (!userData || userData.email_verified) {
        return res.status(404).json({
          success: false,
          message: 'Email not found or already verified',
        });
      }

      const token = generateEmailVerificationToken(userData.id);
      await emailService.sendEmailVerification(email, token);
      return res.status(200).json({
        success: true,
        message:
          'Verification email resent successfully. Please check your inbox',
      });
    } catch (error) {
      console.error('Resend verification error: ', error);
      return res.status(404).json({
        success: false,
        message: 'Email not found or already verified',
      });
    }
  }
}

module.exports = new AuthController();
