// middleware/protection/loginAttempts.js
const cacheService = require('../../services/cacheService');
const EmailService = require('../../services/emailService');
const User = require('../../models/User');

class LoginAttemptsMiddleware {
  constructor() {
    this.maxAttempts = 5;
    this.lockoutDuration = 15 * 60; // 15 minutes in seconds
    this.attemptWindow = 15 * 60; // 15 minutes window for attempts
  }

  // Track failed login attempts
  async trackFailedAttempt(email, ipAddress) {
    const key = `login_attempts:${email}`;
    const ipKey = `login_attempts_ip:${ipAddress}`;
    
    try {
      // Track by email
      const attempts = await cacheService.incr(key, this.attemptWindow);
      
      // Also track by IP to prevent distributed attacks
      const ipAttempts = await cacheService.incr(ipKey, this.attemptWindow);
      
      // Check if account should be locked
      if (attempts >= this.maxAttempts) {
        await this.lockAccount(email, attempts, ipAddress);
      }
      
      return {
        attempts,
        ipAttempts,
        remainingAttempts: Math.max(0, this.maxAttempts - attempts),
        isLocked: attempts >= this.maxAttempts
      };
    } catch (error) {
      console.error('Failed to track login attempt:', error);
      // Don't block login if tracking fails
      return {
        attempts: 0,
        ipAttempts: 0,
        remainingAttempts: this.maxAttempts,
        isLocked: false
      };
    }
  }

  // Clear attempts on successful login
  async clearAttempts(email, ipAddress) {
    try {
      await cacheService.del(`login_attempts:${email}`);
      await cacheService.del(`login_attempts_ip:${ipAddress}`);
      await cacheService.del(`account_locked:${email}`);
    } catch (error) {
      console.error('Failed to clear login attempts:', error);
    }
  }

  // Check if account is locked
  async isAccountLocked(email) {
    try {
      const lockKey = `account_locked:${email}`;
      const lockData = await cacheService.get(lockKey);
      
      if (lockData) {
        const remainingTime = Math.ceil(
          (lockData.lockedUntil - Date.now()) / 1000 / 60
        );
        
        return {
          isLocked: true,
          reason: lockData.reason,
          lockedUntil: lockData.lockedUntil,
          remainingMinutes: remainingTime
        };
      }
      
      return { isLocked: false };
    } catch (error) {
      console.error('Failed to check account lock:', error);
      return { isLocked: false };
    }
  }

  // Lock account after too many attempts
  async lockAccount(email, attempts, ipAddress) {
    try {
      const lockKey = `account_locked:${email}`;
      const lockedUntil = Date.now() + (this.lockoutDuration * 1000);
      
      const lockData = {
        email,
        attempts,
        ipAddress,
        lockedAt: Date.now(),
        lockedUntil,
        reason: `${attempts} failed login attempts`
      };
      
      await cacheService.set(lockKey, lockData, this.lockoutDuration);
      
      // Send notification email
      try {
        const user = await User.findByEmail(email);
        if (user) {
          const emailService = new EmailService();
          await emailService.sendAccountLockedNotification({
            to: email,
            fullName: user.full_name || 'User',
            lockReason: lockData.reason,
            attemptCount: attempts,
            unlockTime: new Date(lockedUntil)
          });
        }
      } catch (emailError) {
        console.error('Failed to send lock notification:', emailError);
      }
      
      // Log security event
      console.warn(`Account locked: ${email} after ${attempts} attempts from IP: ${ipAddress}`);
      
    } catch (error) {
      console.error('Failed to lock account:', error);
    }
  }

  // Middleware to check login attempts before processing
  checkLoginAttempts() {
    return async (req, res, next) => {
      const { email } = req.body;
      const ipAddress = req.ip;
      
      if (!email) {
        return next();
      }
      
      try {
        // Check if account is locked
        const lockStatus = await this.isAccountLocked(email);
        
        if (lockStatus.isLocked) {
          return res.status(429).json({
            success: false,
            error: 'Tài khoản tạm thời bị khóa do nhiều lần đăng nhập thất bại',
            details: {
              reason: lockStatus.reason,
              remainingMinutes: lockStatus.remainingMinutes,
              message: `Vui lòng thử lại sau ${lockStatus.remainingMinutes} phút`
            }
          });
        }
        
        // Check IP-based rate limiting
        const ipKey = `login_attempts_ip:${ipAddress}`;
        const ipAttempts = await cacheService.get(ipKey) || 0;
        
        if (ipAttempts >= this.maxAttempts * 2) { // Higher limit for IP
          return res.status(429).json({
            success: false,
            error: 'Quá nhiều yêu cầu từ địa chỉ IP này',
            details: {
              message: 'Vui lòng thử lại sau 15 phút'
            }
          });
        }
        
        // Attach tracking functions to request
        req.loginTracking = {
          trackFailure: () => this.trackFailedAttempt(email, ipAddress),
          clearAttempts: () => this.clearAttempts(email, ipAddress)
        };
        
        next();
      } catch (error) {
        console.error('Login attempts middleware error:', error);
        // Don't block on error
        next();
      }
    };
  }

  // Get current attempt status
  async getAttemptStatus(email) {
    try {
      const key = `login_attempts:${email}`;
      const attempts = await cacheService.get(key) || 0;
      const lockStatus = await this.isAccountLocked(email);
      
      return {
        attempts: parseInt(attempts),
        maxAttempts: this.maxAttempts,
        remainingAttempts: Math.max(0, this.maxAttempts - attempts),
        isLocked: lockStatus.isLocked,
        lockDetails: lockStatus.isLocked ? lockStatus : null
      };
    } catch (error) {
      console.error('Failed to get attempt status:', error);
      return {
        attempts: 0,
        maxAttempts: this.maxAttempts,
        remainingAttempts: this.maxAttempts,
        isLocked: false
      };
    }
  }
}

module.exports = new LoginAttemptsMiddleware();