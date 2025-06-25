const supabase = require('../config/database');

class User {
    static async findById(id) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .single();
            
        if (error) throw error;
        return data;
    }
    
    static async findByEmail(email) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();
            
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }
    
    static async create(userData) {
        const { data, error } = await supabase
            .from('users')
            .insert(userData)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }
    
    static async update(id, updates) {
        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }
    
    static async delete(id) {
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', id);
            
        if (error) throw error;
        return true;
    }
    
    static async getWithStats(id) {
        const { data, error } = await supabase
            .from('users')
            .select(`
                *,
                stats:user_stats(*),
                settings:user_settings(*)
            `)
            .eq('id', id)
            .single();
            
        if (error) throw error;
        return data;
    }
}

module.exports = User;