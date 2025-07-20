const supabase = require('../config/database');

class AuthToken {
  static async create(token, userId, tokenType, expiresAt) {
    const { data, error } = await supabase
      .from('auth_tokens')
      .insert({
        token: token,
        user_id: userId,
        token_type: tokenType,
        expires_at: expiresAt,
      })
      .select();

    if (error) throw error;
    return data;
  }

  static async get(token) {
    const { data, error } = await supabase
      .from('auth_tokens')
      .select()
      .eq('token', token)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async updateUsedAt(token) {
    return await supabase
      .from('auth_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token);
  }
}

module.exports = AuthToken;
