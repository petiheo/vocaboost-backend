// models/Word.js

const supabase = require('../config/database');

class Word {
    /**
     * CREATE: Adds a new word to a list.
     * @param {object} itemData - The word's data.
     * @returns {Promise<object>} The newly created word object.
     */
    static async create(itemData) {
        const { data, error } = await supabase
            .from('words') // Changed from 'vocabulary_items'
            .insert(itemData)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }

    /**
     * CREATE (Bulk): Adds multiple words to a list.
     * @param {Array<object>} items - An array of word objects.
     * @returns {Promise<Array<object>>} An array of the created words.
     */
    static async createBulk(items) {
        const { data, error } = await supabase
            .from('words') // Changed from 'vocabulary_items'
            .insert(items)
            .select();
            
        if (error) throw error;
        return data;
    }

    /**
     * READ (Single): Finds a word by its ID.
     * @param {string} id - The UUID of the word.
     * @returns {Promise<object|null>}
     */
    static async findById(id) {
        const { data, error } = await supabase
            .from('words')
            .select('*')
            .eq('id', id)
            .single();
            
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }

    /**
     * READ (Multiple): Finds all words belonging to a specific list.
     * @param {string} listId - The UUID of the list.
     * @returns {Promise<Array<object>>}
     */
    static async findByListId(listId) {
        const { data, error } = await supabase
            .from('words')
            .select('*')
            .eq('list_id', listId)
            .order('created_at', { ascending: true });
            
        if (error) throw error;
        return data || [];
    }

    /**
     * UPDATE: Modifies an existing word.
     * @param {string} id - The UUID of the word.
     * @param {object} updates - The fields to update.
     * @returns {Promise<object>} The updated word object.
     */
    static async update(id, updates) {
        const { data, error } = await supabase
            .from('words')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }

    /**
     * DELETE: Deletes a word.
     * @param {string} id - The UUID of the word to delete.
     * @returns {Promise<boolean>}
     */
    static async delete(id) {
        const { error } = await supabase
            .from('words')
            .delete()
            .eq('id', id);
            
        if (error) throw error;
        return true;
    }
}

module.exports = Word;