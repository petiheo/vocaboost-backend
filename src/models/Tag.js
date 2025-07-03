// models/Tag.js

const supabase = require('../config/database');

class Tag {
    /**
     * CREATE: Creates a new tag. Intended for admin use only.
     * @param {string} name - The name of the tag to create.
     * @returns {Promise<object>} The newly created tag object.
     */
    static async create(name) {
        const { data, error } = await supabase
            .from('tags')
            .insert({ name: name.toLowerCase().trim() })
            .select()
            .single();

        if (error) {
            // Code '23505' is for unique violation, which is okay if the tag already exists.
            if (error.code === '23505') {
                return this.findByName(name);
            }
            console.error('Error creating tag:', error);
            throw new Error(error.message);
        }
        return data;
    }

    /**
     * READ (All): Gets all available tags for users to select from.
     * @returns {Promise<Array<object>>} An array of all tag objects.
     */
    static async getAll() {
        const { data, error } = await supabase
            .from('tags')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching all tags:', error);
            throw new Error(error.message);
        }
        return data || [];
    }

    /**
     * READ (By Name): Finds a single tag by its name.
     * @param {string} name - The name of the tag.
     * @returns {Promise<object|null>} The tag object or null if not found.
     */
    static async findByName(name) {
        const { data, error } = await supabase
            .from('tags')
            .select('*')
            .eq('name', name.toLowerCase().trim())
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }

    /**
     * Helper: Finds tag IDs for an array of tag names.
     * This is crucial for linking tags to a list. It only returns IDs for existing tags.
     * @param {Array<string>} tagNames - An array of tag names.
     * @returns {Promise<Array<number>>} An array of corresponding tag IDs.
     */
    static async findIdsByNames(tagNames = []) {
        if (!tagNames || tagNames.length === 0) return [];
        
        const lowercasedNames = tagNames.map(name => name.toLowerCase().trim());

        const { data, error } = await supabase
            .from('tags')
            .select('id')
            .in('name', lowercasedNames);

        if (error) {
            console.error('Error finding tag IDs by names:', error);
            throw new Error(error.message);
        }
        return data.map(tag => tag.id);
    }
}

module.exports = Tag;