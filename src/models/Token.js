const supabase = require('../config/database');

class Token {
    // Password reset tokens
    static async createPasswordResetToken(userId, token, expiresAt) {
        const { data, error } = await supabase
            .from('password_resets')
            .insert({
                user_id: userId,
                token,
                expires_at: expiresAt,
                created_at: new Date()
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    static async findPasswordResetToken(token) {
        const { data, error } = await supabase
            .from('password_resets')
            .select(`*, user:users(*)`)
            .eq('token', token)
            .gte('expires_at', new Date().toISOString())
            .eq('used', false)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }

    static async usePasswordResetToken(token) {
        const { error } = await supabase
            .from('password_resets')
            .update({ used: true, used_at: new Date() })
            .eq('token', token);

        if (error) throw error;
        return true;
    }

    // Email verification tokens
    static async createEmailVerificationToken(userId, token, expiresAt) {
        const { data, error } = await supabase
            .from('email_verification_tokens')
            .insert({
                user_id: userId,
                token,
                expires_at: expiresAt,
                created_at: new Date()
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    static async findEmailVerificationToken(token) {
        const { data, error } = await supabase
            .from('email_verification_tokens')
            .select(`*, user:users(*)`)
            .eq('token', token)
            .gte('expires_at', new Date().toISOString())
            .eq('used', false)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }

    static async useEmailVerificationToken(token) {
        const { error } = await supabase
            .from('email_verification_tokens')
            .update({ used: true, used_at: new Date() })
            .eq('token', token);

        if (error) throw error;
        return true;
    }
}

module.exports = Token;
