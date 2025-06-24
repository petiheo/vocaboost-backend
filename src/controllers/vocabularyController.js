const supabase = require('../config/database');
const aiService = require('../services/aiService');

class VocabularyController {
    // Get all vocabulary lists - USC8: Choose vocabulary list
    async getLists(req, res) {
        try {
            const userId = req.user?.id;
            const { search, tag, privacy } = req.query;
            
            let query = supabase
                .from('vocabulary_lists')
                .select(`
                    *,
                    creator:users!owner_id(display_name),
                    words:vocabulary_items(count)
                `);
            
            // Filter by privacy
            if (privacy) {
                query = query.eq('privacy', privacy);
            } else {
                // Default: show public lists and user's own lists
                query = query.or(`privacy.eq.public${userId ? `,owner_id.eq.${userId}` : ''}`);
            }
            
            // Search
            if (search) {
                query = query.ilike('name', `%${search}%`);
            }
            
            // Filter by tag
            if (tag) {
                query = query.contains('tags', [tag]);
            }
            
            const { data: lists, error } = await query;
            
            if (error) throw error;
            
            res.json({ lists });
            
        } catch (error) {
            console.error('Get lists error:', error);
            res.status(500).json({ error: 'Failed to fetch lists' });
        }
    }
    
    // Create vocabulary list - USC9: Create new vocabulary list
    async createList(req, res) {
        try {
            const userId = req.user.id;
            const { name, description, privacy = 'private', tags = [], words = [] } = req.body;
            
            // Create list
            const { data: list, error: listError } = await supabase
                .from('vocabulary_lists')
                .insert({
                    name,
                    description,
                    owner_id: userId,
                    privacy,
                    tags
                })
                .select()
                .single();
                
            if (listError) throw listError;
            
            // Add words if provided
            if (words.length > 0) {
                const vocabularyItems = await Promise.all(words.map(async (word) => {
                    // Generate AI example if not provided
                    let exampleSentence = word.example_sentence;
                    if (!exampleSentence && word.generate_example) {
                        exampleSentence = await aiService.generateExample(word.word);
                    }
                    
                    return {
                        list_id: list.id,
                        word: word.word,
                        meaning: word.meaning,
                        pronunciation: word.pronunciation,
                        example_sentence: exampleSentence,
                        image_url: word.image_url
                    };
                }));
                
                const { error: wordsError } = await supabase
                    .from('vocabulary_items')
                    .insert(vocabularyItems);
                    
                if (wordsError) throw wordsError;
            }
            
            res.status(201).json({
                message: 'Vocabulary list created successfully',
                list
            });
            
        } catch (error) {
            console.error('Create list error:', error);
            res.status(500).json({ error: 'Failed to create list' });
        }
    }
    
    // Get single vocabulary list - USC10: View vocabulary list
    async getList(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user?.id;
            
            // Get list with words
            const { data: list, error } = await supabase
                .from('vocabulary_lists')
                .select(`
                    *,
                    creator:users!owner_id(display_name),
                    words:vocabulary_items(*)
                `)
                .eq('id', id)
                .single();
                
            if (error) throw error;
            
            // Check access permission
            if (list.privacy === 'private' && list.owner_id !== userId) {
                return res.status(403).json({ error: 'Access denied' });
            }
            
            // Get learning progress if user is authenticated
            if (userId) {
                const { data: progress } = await supabase
                    .from('learning_progress')
                    .select('*')
                    .eq('user_id', userId)
                    .in('word_id', list.words.map(w => w.id));
                    
                // Merge progress data
                list.words = list.words.map(word => {
                    const wordProgress = progress?.find(p => p.word_id === word.id);
                    return {
                        ...word,
                        progress: wordProgress || null
                    };
                });
            }
            
            res.json({ list });
            
        } catch (error) {
            console.error('Get list error:', error);
            res.status(500).json({ error: 'Failed to fetch list' });
        }
    }
    
    // Update vocabulary list - USC11: Edit vocabulary list
    async updateList(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const updates = req.body;
            
            // Check ownership
            const { data: list } = await supabase
                .from('vocabulary_lists')
                .select('owner_id')
                .eq('id', id)
                .single();
                
            if (!list || list.owner_id !== userId) {
                return res.status(403).json({ error: 'Access denied' });
            }
            
            // Update list
            const { error } = await supabase
                .from('vocabulary_lists')
                .update({
                    name: updates.name,
                    description: updates.description,
                    privacy: updates.privacy,
                    tags: updates.tags,
                    updated_at: new Date()
                })
                .eq('id', id);
                
            if (error) throw error;
            
            res.json({ message: 'List updated successfully' });
            
        } catch (error) {
            console.error('Update list error:', error);
            res.status(500).json({ error: 'Failed to update list' });
        }
    }
    
    // Delete vocabulary list
    async deleteList(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            
            // Check ownership
            const { data: list } = await supabase
                .from('vocabulary_lists')
                .select('owner_id')
                .eq('id', id)
                .single();
                
            if (!list || list.owner_id !== userId) {
                return res.status(403).json({ error: 'Access denied' });
            }
            
            // Delete list (cascade delete words)
            const { error } = await supabase
                .from('vocabulary_lists')
                .delete()
                .eq('id', id);
                
            if (error) throw error;
            
            res.json({ message: 'List deleted successfully' });
            
        } catch (error) {
            console.error('Delete list error:', error);
            res.status(500).json({ error: 'Failed to delete list' });
        }
    }
    
    // Add word to list
    async addWord(req, res) {
        try {
            const { listId } = req.params;
            const userId = req.user.id;
            const wordData = req.body;
            
            // Check ownership
            const { data: list } = await supabase
                .from('vocabulary_lists')
                .select('owner_id')
                .eq('id', listId)
                .single();
                
            if (!list || list.owner_id !== userId) {
                return res.status(403).json({ error: 'Access denied' });
            }
            
            // Generate AI example if needed
            if (!wordData.example_sentence && wordData.generate_example) {
                wordData.example_sentence = await aiService.generateExample(wordData.word);
            }
            
            // Add word
            const { data: word, error } = await supabase
                .from('vocabulary_items')
                .insert({
                    list_id: listId,
                    word: wordData.word,
                    meaning: wordData.meaning,
                    pronunciation: wordData.pronunciation,
                    example_sentence: wordData.example_sentence,
                    image_url: wordData.image_url
                })
                .select()
                .single();
                
            if (error) throw error;
            
            res.status(201).json({ word });
            
        } catch (error) {
            console.error('Add word error:', error);
            res.status(500).json({ error: 'Failed to add word' });
        }
    }
}

module.exports = new VocabularyController();