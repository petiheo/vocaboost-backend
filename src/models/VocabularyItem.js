const supabase = require('../config/database');

class VocabularyItem {
    static async create(itemData) {
        const { data, error } = await supabase
            .from('vocabulary_items')
            .insert(itemData)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }
    
    static async createBulk(items) {
        const { data, error } = await supabase
            .from('vocabulary_items')
            .insert(items)
            .select();
            
        if (error) throw error;
        return data;
    }
    
    static async findById(id) {
        const { data, error } = await supabase
            .from('vocabulary_items')
            .select('*')
            .eq('id', id)
            .single();
            
        if (error) throw error;
        return data;
    }
    
    static async findByListId(listId) {
        const { data, error } = await supabase
            .from('vocabulary_items')
            .select('*')
            .eq('list_id', listId)
            .order('created_at', { ascending: true });
            
        if (error) throw error;
        return data;
    }
    
    static async update(id, updates) {
        const { data, error } = await supabase
            .from('vocabulary_items')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }
    
    static async delete(id) {
        const { error } = await supabase
            .from('vocabulary_items')
            .delete()
            .eq('id', id);
            
        if (error) throw error;
        return true;
    }
    
    static async deleteByListId(listId) {
        const { error } = await supabase
            .from('vocabulary_items')
            .delete()
            .eq('list_id', listId);
            
        if (error) throw error;
        return true;
    }
}

module.exports = VocabularyItem;