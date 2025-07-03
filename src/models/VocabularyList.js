// models/VocabularyList.js

const supabase = require('../config/database');
const Tag = require('./Tag'); // Import the new Tag model

class VocabularyList {
    /**
     * CREATE: Creates a new vocabulary list and links its tags.
     * @param {object} listData - Contains title, description, creator_id, and an array of tag names.
     * @returns {Promise<object>} The newly created list object with its tags.
     */
    static async create(listData) {
        const { title, description, privacy, creator_id, tags: tagNames = [] } = listData;

        // Step 1: Create the main list record
        const { data: newList, error: listError } = await supabase
            .from('vocab_lists')
            .insert({ title, description, privacy, creator_id })
            .select()
            .single();

        if (listError) {
            console.error('Error creating vocab list:', listError);
            throw new Error(listError.message);
        }

        // Step 2: Handle tags. Find existing tag IDs from the provided names.
        if (tagNames.length > 0) {
            const tagIds = await Tag.findIdsByNames(tagNames);
            if (tagIds.length > 0) {
                const listTagData = tagIds.map(tagId => ({
                    list_id: newList.id,
                    tag_id: tagId,
                }));

                // Step 3: Insert into the 'list_tags' junction table
                const { error: tagsError } = await supabase.from('list_tags').insert(listTagData);
                if (tagsError) {
                    console.error('Error linking tags to list:', tagsError);
                    // In a real production scenario, you might want to roll back the list creation here.
                    throw new Error(tagsError.message);
                }
            }
        }
        
        return newList;
    }

    /**
     * READ (Single): Finds a single list by its ID, including its words and tags.
     * @param {string} id - The UUID of the list.
     * @returns {Promise<object|null>} The list object.
     */
    static async findById(id) {
        const { data, error } = await supabase
            .from('vocab_lists')
            .select(`
                *,
                creator:users(full_name),
                words(*),
                tags:list_tags(tag:tags(*))
            `)
            .eq('id', id)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        
        // Clean up the tags structure to be a simple array of tag objects
        if (data && data.tags) {
            data.tags = data.tags.map(t => t.tag);
        }

        return data;
    }

    /**
     * READ (Multiple): Finds all lists by a user.
     * @param {string} creatorId - The UUID of the user.
     * @returns {Promise<Array<object>>} An array of the user's lists.
     */
    static async findByCreator(creatorId) {
        const { data, error } = await supabase
            .from('vocab_lists')
            .select('*')
            .eq('creator_id', creatorId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    }

    /**
     * UPDATE: Updates a list's properties and its associated tags.
     * @param {string} id - The UUID of the list to update.
     * @param {object} updates - Contains fields to update, including a `tags` array of names.
     * @returns {Promise<object>} The updated list object.
     */
    static async update(id, updates) {
        const { tags: tagNames, ...listUpdates } = updates;

        // Step 1: Update the core list details if any are provided
        if (Object.keys(listUpdates).length > 0) {
            const { error: updateError } = await supabase
                .from('vocab_lists')
                .update({ ...listUpdates, updated_at: new Date() })
                .eq('id', id);

            if (updateError) throw updateError;
        }

        // Step 2: If tags are part of the update, resync them.
        if (tagNames !== undefined) {
            // Easiest strategy: delete all existing tag links, then add the new ones.
            const { error: deleteError } = await supabase.from('list_tags').delete().eq('list_id', id);
            if (deleteError) throw deleteError;

            if (tagNames.length > 0) {
                const tagIds = await Tag.findIdsByNames(tagNames);
                if (tagIds.length > 0) {
                    const listTagData = tagIds.map(tagId => ({
                        list_id: id,
                        tag_id: tagId,
                    }));
                    const { error: insertError } = await supabase.from('list_tags').insert(listTagData);
                    if (insertError) throw insertError;
                }
            }
        }
        
        return this.findById(id); // Return the fully updated list
    }

    /**
     * DELETE: Deletes a list and its associated tag links and words (via CASCADE).
     * @param {string} id - The UUID of the list to delete.
     * @returns {Promise<boolean>} True on success.
     */
    static async delete(id) {
        const { error } = await supabase
            .from('vocab_lists')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    }
}

module.exports = VocabularyList;