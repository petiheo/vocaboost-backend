const supabase = require('../config/database');

class VocabularyList {
    static async create(listData) {
        const { data, error } = await supabase
            .from('vocabulary_lists')
            .insert(listData)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }
    
    static async findById(id) {
        const { data, error } = await supabase
            .from('vocabulary_lists')
            .select(`
                *,
                creator:users!owner_id(display_name),
                words:vocabulary_items(*)
            `)
            .eq('id', id)
            .single();
            
        if (error) throw error;
        return data;
    }
    
    static async findByOwner(ownerId) {
        const { data, error } = await supabase
            .from('vocabulary_lists')
            .select('*')
            .eq('owner_id', ownerId)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        return data;
    }
    
    static async findPublic(limit = 50, offset = 0) {
        const { data, error } = await supabase
            .from('vocabulary_lists')
            .select(`
                *,
                creator:users!owner_id(display_name),
                word_count:vocabulary_items(count)
            `)
            .eq('privacy', 'public')
            .range(offset, offset + limit - 1)
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        return data;
    }
    
    static async update(id, updates) {
        const { data, error } = await supabase
            .from('vocabulary_lists')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }
    
    static async delete(id) {
        const { error } = await supabase
            .from('vocabulary_lists')
            .delete()
            .eq('id', id);
            
        if (error) throw error;
        return true;
    }
    
    static async search(query, filters = {}) {
        let dbQuery = supabase
            .from('vocabulary_lists')
            .select('*');
            
        if (query) {
            dbQuery = dbQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
        }
        
        if (filters.privacy) {
            dbQuery = dbQuery.eq('privacy', filters.privacy);
        }
        
        if (filters.tags && filters.tags.length > 0) {
            dbQuery = dbQuery.contains('tags', filters.tags);
        }
        
        const { data, error } = await dbQuery;
        
        if (error) throw error;
        return data;
    }
}

module.exports = VocabularyList;