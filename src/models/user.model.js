const supabase = require('../config/database');

class UserModel {
  async findByEmail(email) {
    const { data, error } = await supabase
      .from('users')
      .select()
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async create(email, hashedPassword, role) {
    const { data, error } = await supabase
      .from('users')
      .insert({
        email: email,
        password_hash: hashedPassword,
        role: role,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async findByGoogleId(id) {
    const { data, error } = await supabase
      .from('users')
      .select()
      .eq('google_id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async updateGoogleId(userId, googleId) {
    const { data, error } = await supabase
      .from('users')
      .update({
        google_id: googleId,
        email_verified: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateDisplayName(id, displayName) {
    const { data, error } = await supabase
      .from('users')
      .update({
        display_name: displayName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateAvartar(id, avatar) {
    const { data, error } = await supabase
      .from('users')
      .update({
        avatar_url: avatar,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createGoogleUser({
    email,
    googleId,
    displayName,
    avatarUrl,
    role = 'learner',
  }) {
    const { data, error } = await supabase
      .from('users')
      .insert({
        email,
        google_id: googleId,
        display_name: displayName,
        avatar_url: avatarUrl,
        role,
        email_verified: true,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updatePassword(id, hashedPassword) {
    return await supabase
      .from('users')
      .update({
        password_hash: hashedPassword,
        password_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
  }

  async verifyEmail(id) {
    return await supabase
      .from('users')
      .update({
        email_verified: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
  }

  async findById(id) {
    const { data, error } = await supabase
      .from('users')
      .select()
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async updateRole(id, role) {
    const { data, error } = await supabase
      .from('users')
      .update({
        role: role,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

module.exports = new UserModel();
