const userModel = require('../models/user.model');
const bcrypt = require('bcryptjs');
const AuthToken = require('../models/authToken.model');
const ms = require('ms');

class AuthService {
  async findUserByEmail(email) {
    return await userModel.findByEmail(email);
  }

  async insertIntoUsers(email, password, role) {
    const hashedPassword = await bcrypt.hash(password, 10);
    return await userModel.create(email, hashedPassword, role);
  }

  async insertIntoAuthTokens(token, userId, tokenType, expiresIn) {
    const expiredAt = new Date(Date.now() + ms(expiresIn));
    return await AuthToken.create(token, userId, tokenType, expiredAt);
  }

  async validatePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  async isUsedToken(token) {
    const tokenInDb = await AuthToken.get(token);
    return (
      !tokenInDb ||
      tokenInDb.used_at !== null ||
      new Date(tokenInDb.expires_at) < new Date()
    );
  }

  async updateUsedAt(token) {
    return await AuthToken.updateUsedAt(token);
  }

  async updatePassword(userId, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    return await userModel.updatePassword(userId, hashedPassword);
  }

  async verifyEmail(id) {
    return await userModel.verifyEmail(id);
  }
}

module.exports = new AuthService();
