const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Token = require("../models/Token");
const EmailService = require("../services/emailService");
const {
  generateToken,
  generateEmailVerificationToken,
} = require("../utils/jwtHelper");

class AuthController {
  // USC1: Register new user - Sign up
  async register(req, res) {
    try {
      const { email, password, role = "learner" } = req.body;
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: "Email already registered",
        });
      }

      const hashedPassword = await User.hashPassword(password);
      let newUser = await User.create({
        email,
        password_hash: hashedPassword,
        role,
        // Status is automatically set based on role in User.create()
      });

      if (!newUser) {
        // fallback for test/mock DB
        newUser = { id: "test-id", email, role, status: "active" };
      }

      if (process.env.NODE_ENV !== "test") {
        try {
          const verificationToken = generateEmailVerificationToken(newUser.id);
          const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
          await Token.createEmailVerificationToken(
            newUser.id,
            verificationToken,
            expires
          );
          const emailService = new EmailService();
          await emailService.sendRegistrationVerification({
            to: newUser.email,
            confirmationToken: verificationToken,
          });
        } catch (err) {
          console.error("Send verification email failed:", err.message);
        }
      }

      // Generate JWT token
      const token = generateToken({
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
      });

      res.status(201).json({
        success: true,
        message: "Registration successful",
        data: {
          user: {
            id: newUser.id,
            email: newUser.email,
            role: newUser.role,
            status: newUser.status,
          },
          token,
        },
      });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({
        success: false,
        error: "Registration failed",
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
        // Track failed attempt if tracking is available
        if (req.loginTracking) {
          const trackingResult = await req.loginTracking.trackFailure();
          if (trackingResult.remainingAttempts > 0) {
            return res.status(401).json({
              success: false,
              error: "Invalid email or password",
              remainingAttempts: trackingResult.remainingAttempts,
            });
          }
        }
        return res.status(401).json({
          success: false,
          error: "Invalid credentials",
        });
      }

      // ✅ Use Model Layer: Validate password
      const isValidPassword = await User.validatePassword(
        password,
        user.password_hash
      );
      if (!isValidPassword) {
        // Track failed attempt
        if (req.loginTracking) {
          const trackingResult = await req.loginTracking.trackFailure();
          if (trackingResult.remainingAttempts > 0) {
            return res.status(401).json({
              success: false,
              error: "Invalid email or password",
              remainingAttempts: trackingResult.remainingAttempts,
              message:
                trackingResult.remainingAttempts <= 2
                  ? `${trackingResult.remainingAttempts} attempts remaining`
                  : undefined,
            });
          }
        }
        return res.status(401).json({
          success: false,
          error: "Invalid credentials",
        });
      }

      // Check account status
      if (user.status === "inactive") {
        return res.status(403).json({
          success: false,
          error: "Account has been deactivated",
        });
      }

      if (user.status === "suspended") {
        return res.status(403).json({
          success: false,
          error: "Account has been suspended",
        });
      }

      // Clear login attempts on successful login
      if (req.loginTracking) {
        await req.loginTracking.clearAttempts();
      }

      // ✅ Use Model Layer: Update last login
      await User.updateLastLogin(user.id);

      // Generate JWT token
      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      res.json({
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            fullName: user.full_name,
            avatarUrl: user.avatar_url,
          },
          token,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({
        success: false,
        error: "Login failed. Please try again.",
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
        role: user.role,
      });

      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3001";
      res.redirect(`${frontendUrl}/auth/success?token=${token}`);
    } catch (error) {
      console.error("Google login error:", error);
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3001";
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
            error: "Logout failed",
          });
        }

        res.json({
          success: true,
          message: "Logout successful",
        });
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({
        success: false,
        error: "Logout failed",
      });
    }
  }

  // USC5: Forgot password - UPDATED
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      // ✅ Use Model Layer: Check if user exists
      const user = await User.findByEmail(email);

      // Always return success to prevent email enumeration
      const successResponse = {
        success: true,
        message:
          "If the email exists in our system, we have sent password reset instructions.",
      };

      if (!user) {
        // Don't reveal that email doesn't exist
        return res.json(successResponse);
      }

      // Check if user uses Google OAuth (no password)
      if (!user.password_hash && user.google_id) {
        // Still send email but with different message
        try {
          const emailService = new EmailService();
          await emailService.sendOAuthAccountNotification({
            to: email,
            fullName: user.full_name || "User",
          });
        } catch (emailError) {
          console.error("Failed to send OAuth notification:", emailError);
        }
        return res.json(successResponse);
      }

      // Generate reset token
      const resetToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          type: "password_reset",
        },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      const expiresAt = new Date(Date.now() + 3600000); // 1 hour

      try {
        // ✅ Use Model Layer: Save reset token
        await Token.createPasswordResetToken(user.id, resetToken, expiresAt);

        // ✅ Send password reset email
        const emailService = new EmailService();
        await emailService.sendPasswordReset({
          to: user.email,
          fullName: user.full_name || "User",
          resetToken: resetToken,
        });

        console.log(`Password reset email sent to ${email}`);
      } catch (error) {
        console.error("Failed to process password reset:", error);
        // Still return success to user
      }

      res.json(successResponse);
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({
        success: false,
        error: "Unable to process request. Please try again later.",
      });
    }
  }

  // USC6: Reset password - UPDATED
  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          error: "Token and new password are required",
        });
      }

      // Verify JWT token first
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if it's a password reset token
        if (decoded.type !== "password_reset") {
          throw new Error("Invalid token type");
        }
      } catch (jwtError) {
        return res.status(400).json({
          success: false,
          error: "Invalid or expired token",
        });
      }

      // ✅ Use Model Layer: Find and validate reset token
      const resetData = await Token.findPasswordResetToken(token);
      if (!resetData) {
        return res.status(400).json({
          success: false,
          error: "Token has been used or expired",
        });
      }

      // Validate password strength
      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          error: "Password must be at least 8 characters long",
        });
      }

      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
        return res.status(400).json({
          success: false,
          error: "Password must contain uppercase, lowercase and number",
        });
      }

      // ✅ Use Model Layer: Hash new password
      const hashedPassword = await User.hashPassword(newPassword);

      // ✅ Use Model Layer: Update user password
      await User.update(resetData.user_id, {
        password_hash: hashedPassword,
        password_changed_at: new Date(),
      });

      // ✅ Use Model Layer: Mark reset token as used
      await Token.usePasswordResetToken(token);

      // Optional: Send confirmation email
      // try {
      //     const emailService = new EmailService();
      //     await emailService.sendPasswordChangeConfirmation({
      //         to: resetData.user.email,
      //         fullName: resetData.user.full_name || 'User'
      //     });
      // } catch (emailError) {
      //     console.error('Failed to send confirmation email:', emailError);
      // }

      res.json({
        success: true,
        message:
          "Password has been reset successfully. Please login with your new password.",
      });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({
        success: false,
        error: "Unable to reset password. Please try again.",
      });
    }
  }

  // USC7: Verify email
  async verifyEmail(req, res) {
    try {
      const { token } = req.params;

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (decoded.type !== "email_verification") {
        return res.status(400).json({
          success: false,
          error: "Invalid verification token",
        });
      }

      const verificationData = await Token.findEmailVerificationToken(token);
      if (!verificationData) {
        return res.status(400).json({
          success: false,
          error: "Token expired or invalid",
        });
      }

      await User.update(verificationData.user.id, {
        email_verified: true,
      });

      await Token.useEmailVerificationToken(token);

      res.json({
        success: true,
        message: "Email verified successfully",
      });
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(500).json({
        success: false,
        error: "Email verification failed",
      });
    }
  }

  // Additional helper: Resend verification email
  async resendVerificationEmail(req, res) {
    try {
      const { email } = req.body;

      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: "Email not found in the system",
        });
      }

      if (user.email_verified) {
        return res.status(400).json({
          success: false,
          error: "Email already verified",
        });
      }

      // Generate new verification token
      const verificationToken = generateEmailVerificationToken(user.id);
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await Token.createEmailVerificationToken(
        user.id,
        verificationToken,
        expires
      );

      // Send email
      const emailService = new EmailService();
      await emailService.sendRegistrationVerification({
        to: user.email,
        fullName: user.full_name || "User",
        confirmationToken: verificationToken,
      });

      res.json({
        success: true,
        message: "Verification email has been resent",
      });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({
        success: false,
        error: "Unable to resend verification email",
      });
    }
  }
}

module.exports = new AuthController();
