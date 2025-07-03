// controllers/vocabularyController.js

const VocabularyList = require('../models/VocabularyList');
const Word = require('../models/Word');
const Tag = require('../models/Tag'); // Although not directly used, it's good practice
const aiService = require('../services/aiService');

class VocabularyController {
    /**
     * Handles POST /api/vocabulary/lists
     * Creates a new vocabulary list.
     */
    async createList(req, res, next) {
        try {
            const listData = {
                ...req.body, // Contains title, description, privacy, tags array
                creator_id: req.user.id // Add creator from authenticated user
            };
            const newList = await VocabularyList.create(listData);
            res.status(201).json({ success: true, data: newList });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Handles GET /api/vocabulary/lists/:id
     * Retrieves a single vocabulary list by its ID.
     */
    async getListById(req, res, next) {
        try {
            const { id } = req.params;
            const list = await VocabularyList.findById(id);

            if (!list) {
                return res.status(404).json({ success: false, error: 'List not found' });
            }

            // Permission Check for private lists
            if (list.privacy === 'private' && list.creator_id !== req.user?.id) {
                return res.status(403).json({ success: false, error: 'Access denied' });
            }

            res.json({ success: true, data: list });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Handles GET /api/vocabulary/my-lists
     * Retrieves all lists created by the currently authenticated user.
     */
    async getMyLists(req, res, next) {
        try {
            const lists = await VocabularyList.findByCreator(req.user.id);
            res.json({ success: true, data: lists });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Handles PUT /api/vocabulary/lists/:id
     * Updates an existing vocabulary list.
     */
    async updateList(req, res, next) {
        try {
            const { id } = req.params;
            const updates = req.body;

            // Security Check: Verify ownership before updating
            const existingList = await VocabularyList.findById(id);
            if (!existingList) {
                return res.status(404).json({ success: false, error: 'List not found' });
            }
            if (existingList.creator_id !== req.user.id) {
                return res.status(403).json({ success: false, error: 'You do not have permission to edit this list' });
            }

            const updatedList = await VocabularyList.update(id, updates);
            res.json({ success: true, data: updatedList, message: 'List updated successfully.' });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Handles DELETE /api/vocabulary/lists/:id
     * Deletes a vocabulary list.
     */
    async deleteList(req, res, next) {
        try {
            const { id } = req.params;

            // Security Check: Verify ownership before deleting
            const existingList = await VocabularyList.findById(id);
            if (!existingList) {
                return res.status(404).json({ success: false, error: 'List not found' });
            }
            if (existingList.creator_id !== req.user.id) {
                return res.status(403).json({ success: false, error: 'You do not have permission to delete this list' });
            }

            await VocabularyList.delete(id);
            res.status(200).json({ success: true, message: 'List deleted successfully.' });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Handles POST /api/vocabulary/lists/:listId/words
     * Adds a new word to a specific list.
     */
    async addWordToList(req, res, next) {
        try {
            const { listId } = req.params;
            const wordData = req.body;

            // Security Check: Verify ownership of the list
            const list = await VocabularyList.findById(listId);
            if (!list || list.creator_id !== req.user.id) {
                return res.status(403).json({ success: false, error: 'You do not have permission to add words to this list' });
            }
            
            // Optional AI feature integration
            if (wordData.generate_example && !wordData.example_sentence) {
                wordData.example_sentence = await aiService.generateExample(wordData.term);
            }
            
            const newWord = await Word.create({
                ...wordData,
                list_id: listId,
            });

            res.status(201).json({ success: true, data: newWord });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Handles PUT /api/vocabulary/words/:wordId
     * Updates a specific word.
     */
    async updateWord(req, res, next) {
        try {
            const { wordId } = req.params;
            const updates = req.body;

            // Security Check: Verify user owns the word via the list it belongs to
            const word = await Word.findById(wordId);
            if (!word) {
                 return res.status(404).json({ success: false, error: 'Word not found' });
            }
            const list = await VocabularyList.findById(word.list_id);
            if (!list || list.creator_id !== req.user.id) {
                return res.status(403).json({ success: false, error: 'You do not have permission to edit this word' });
            }

            const updatedWord = await Word.update(wordId, updates);
            res.json({ success: true, data: updatedWord });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Handles DELETE /api/vocabulary/words/:wordId
     * Deletes a specific word.
     */
    async deleteWord(req, res, next) {
        try {
            const { wordId } = req.params;
            
            // Security Check: Verify user owns the word via its list
            const word = await Word.findById(wordId);
            if (!word) {
                return res.status(404).json({ success: false, error: 'Word not found' });
            }
            const list = await VocabularyList.findById(word.list_id);
            if (!list || list.creator_id !== req.user.id) {
                return res.status(403).json({ success: false, error: 'You do not have permission to delete this word' });
            }

            await Word.delete(wordId);
            res.status(200).json({ success: true, message: 'Word deleted successfully.' });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new VocabularyController();