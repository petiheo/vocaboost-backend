// controllers/vocabularyController.js (REFACTORED)
const VocabularyService = require('../models/business-logic/core/VocabularyService');
const { VocabularyListSchema, VocabularyItemSchema } = require('../models/schemas/vocabulary/VocabularyListSchema');

class VocabularyController {
    constructor() {
        this.vocabularyService = new VocabularyService();
    }

    // USC8: Get all vocabulary lists
    async getLists(req, res) {
        try {
            const userId = req.user?.id;
            const filters = {
                search: req.query.search,
                tag: req.query.tag,
                privacy: req.query.privacy,
                difficulty: req.query.difficulty,
                language: req.query.language,
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 20,
                sortBy: req.query.sortBy || 'updated_at',
                sortOrder: req.query.sortOrder || 'desc'
            };

            // Delegate to VocabularyService for business logic
            const result = await this.vocabularyService.getVocabularyLists(userId, filters);

            res.json({
                success: true,
                data: result
            });

        } catch (error) {
            console.error('Get lists error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch vocabulary lists'
            });
        }
    }

    // USC9: Create new vocabulary list
    async createList(req, res) {
        try {
            const userId = req.user.id;
            const listData = {
                name: req.body.name,
                description: req.body.description,
                privacy: req.body.privacy || 'private',
                tags: req.body.tags || [],
                difficulty: req.body.difficulty,
                language: req.body.language,
                words: req.body.words || []
            };

            // Delegate to VocabularyService for business logic
            const result = await this.vocabularyService.createVocabularyList(userId, listData);

            res.status(201).json({
                success: true,
                data: result,
                message: 'Vocabulary list created successfully'
            });

        } catch (error) {
            console.error('Create list error:', error);
            
            // Handle specific business logic errors
            if (error.message.includes('permissions') || 
                error.message.includes('limit')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }

            res.status(500).json({
                success: false,
                error: 'Failed to create vocabulary list'
            });
        }
    }

    // USC10: Get single vocabulary list
    async getList(req, res) {
        try {
            const listId = req.params.id;
            const userId = req.user?.id;
            const options = {
                includeProgress: req.query.includeProgress === 'true',
                includeStats: req.query.includeStats === 'true'
            };

            // Delegate to VocabularyService for business logic
            const result = await this.vocabularyService.getVocabularyListById(listId, userId, options);

            res.json({
                success: true,
                data: result
            });

        } catch (error) {
            console.error('Get list error:', error);
            
            if (error.message === 'List not found' || 
                error.message === 'Access denied') {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            }

            res.status(500).json({
                success: false,
                error: 'Failed to fetch vocabulary list'
            });
        }
    }

    // USC11: Update vocabulary list
    async updateList(req, res) {
        try {
            const listId = req.params.id;
            const userId = req.user.id;
            const updates = {
                name: req.body.name,
                description: req.body.description,
                privacy: req.body.privacy,
                tags: req.body.tags,
                difficulty: req.body.difficulty
            };

            // Delegate to VocabularyService for business logic
            const result = await this.vocabularyService.updateVocabularyList(listId, userId, updates);

            res.json({
                success: true,
                data: result,
                message: 'List updated successfully'
            });

        } catch (error) {
            console.error('Update list error:', error);
            
            if (error.message === 'List not found' || 
                error.message === 'Access denied') {
                return res.status(403).json({
                    success: false,
                    error: error.message
                });
            }

            res.status(500).json({
                success: false,
                error: 'Failed to update vocabulary list'
            });
        }
    }

    // Delete vocabulary list
    async deleteList(req, res) {
        try {
            const listId = req.params.id;
            const userId = req.user.id;

            // Delegate to VocabularyService for business logic
            await this.vocabularyService.deleteVocabularyList(listId, userId);

            res.json({
                success: true,
                message: 'List deleted successfully'
            });

        } catch (error) {
            console.error('Delete list error:', error);
            
            if (error.message === 'List not found' || 
                error.message === 'Access denied') {
                return res.status(403).json({
                    success: false,
                    error: error.message
                });
            }

            res.status(500).json({
                success: false,
                error: 'Failed to delete vocabulary list'
            });
        }
    }

    // Add word to list
    async addWord(req, res) {
        try {
            const listId = req.params.listId;
            const userId = req.user.id;
            const wordData = {
                word: req.body.word,
                meaning: req.body.meaning,
                pronunciation: req.body.pronunciation,
                example_sentence: req.body.example_sentence,
                image_url: req.body.image_url,
                difficulty_level: req.body.difficulty_level,
                part_of_speech: req.body.part_of_speech,
                generate_example: req.body.generate_example || false,
                auto_difficulty: req.body.auto_difficulty || false
            };

            // Delegate to VocabularyService for business logic
            const result = await this.vocabularyService.addWordsToList(listId, [wordData], userId);

            res.status(201).json({
                success: true,
                data: result.items[0],
                message: 'Word added successfully'
            });

        } catch (error) {
            console.error('Add word error:', error);
            
            if (error.message.includes('not found') || 
                error.message.includes('access denied') ||
                error.message.includes('limit exceeded') ||
                error.message.includes('already exist')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }

            res.status(500).json({
                success: false,
                error: 'Failed to add word'
            });
        }
    }

    // Batch add words
    async batchAddWords(req, res) {
        try {
            const listId = req.params.listId;
            const userId = req.user.id;
            const { words, options = {} } = req.body;

            // Delegate to VocabularyService for business logic
            const result = await this.vocabularyService.addWordsToList(listId, words, userId, options);

            res.status(201).json({
                success: true,
                data: result,
                message: `Added ${result.added} words successfully`
            });

        } catch (error) {
            console.error('Batch add words error:', error);
            
            if (error.message.includes('not found') || 
                error.message.includes('access denied') ||
                error.message.includes('limit exceeded')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }

            res.status(500).json({
                success: false,
                error: 'Failed to add words'
            });
        }
    }

    // Update word
    async updateWord(req, res) {
        try {
            const { listId, wordId } = req.params;
            const userId = req.user.id;
            const updates = {
                word: req.body.word,
                meaning: req.body.meaning,
                pronunciation: req.body.pronunciation,
                example_sentence: req.body.example_sentence,
                difficulty_level: req.body.difficulty_level,
                part_of_speech: req.body.part_of_speech
            };

            // Delegate to VocabularyService for business logic
            const result = await this.vocabularyService.updateVocabularyItem(listId, wordId, userId, updates);

            res.json({
                success: true,
                data: result,
                message: 'Word updated successfully'
            });

        } catch (error) {
            console.error('Update word error:', error);
            
            if (error.message.includes('not found') || 
                error.message.includes('access denied')) {
                return res.status(403).json({
                    success: false,
                    error: error.message
                });
            }

            res.status(500).json({
                success: false,
                error: 'Failed to update word'
            });
        }
    }

    // Delete word
    async deleteWord(req, res) {
        try {
            const { listId, wordId } = req.params;
            const userId = req.user.id;

            // Delegate to VocabularyService for business logic
            await this.vocabularyService.deleteVocabularyItem(listId, wordId, userId);

            res.json({
                success: true,
                message: 'Word deleted successfully'
            });

        } catch (error) {
            console.error('Delete word error:', error);
            
            if (error.message.includes('not found') || 
                error.message.includes('access denied')) {
                return res.status(403).json({
                    success: false,
                    error: error.message
                });
            }

            res.status(500).json({
                success: false,
                error: 'Failed to delete word'
            });
        }
    }

    // Search vocabulary
    async searchVocabulary(req, res) {
        try {
            const userId = req.user?.id;
            const searchQuery = req.query.q;
            const filters = {
                listId: req.query.listId,
                difficulty: req.query.difficulty,
                partOfSpeech: req.query.partOfSpeech,
                includeProgress: req.query.includeProgress === 'true',
                onlyNew: req.query.onlyNew === 'true',
                onlyDue: req.query.onlyDue === 'true',
                limit: parseInt(req.query.limit) || 50
            };

            // Delegate to VocabularyService for business logic
            const result = await this.vocabularyService.searchVocabulary(userId, searchQuery, filters);

            res.json({
                success: true,
                data: result
            });

        } catch (error) {
            console.error('Search vocabulary error:', error);
            
            if (error.message.includes('must be at least')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }

            res.status(500).json({
                success: false,
                error: 'Failed to search vocabulary'
            });
        }
    }

    // Get personalized recommendations
    async getRecommendations(req, res) {
        try {
            const userId = req.user.id;
            const limit = parseInt(req.query.limit) || 20;

            // Delegate to VocabularyService for business logic
            const result = await this.vocabularyService.getPersonalizedRecommendations(userId, limit);

            res.json({
                success: true,
                data: result
            });

        } catch (error) {
            console.error('Get recommendations error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get recommendations'
            });
        }
    }

    // Share vocabulary list
    async shareList(req, res) {
        try {
            const listId = req.params.id;
            const userId = req.user.id;
            const shareOptions = {
                recipientEmails: req.body.recipientEmails,
                permissions: req.body.permissions || 'view',
                message: req.body.message,
                expiresAt: req.body.expiresAt
            };

            // Delegate to VocabularyService for business logic
            const result = await this.vocabularyService.shareList(listId, userId, shareOptions);

            res.json({
                success: true,
                data: result
            });

        } catch (error) {
            console.error('Share list error:', error);
            
            if (error.message.includes('not found') || 
                error.message.includes('access denied') ||
                error.message.includes('Invalid permission')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }

            res.status(500).json({
                success: false,
                error: 'Failed to share list'
            });
        }
    }

    // Clone vocabulary list
    async cloneList(req, res) {
        try {
            const listId = req.params.id;
            const userId = req.user.id;
            const options = {
                name: req.body.name,
                includeProgress: req.body.includeProgress || false,
                privacy: req.body.privacy || 'private'
            };

            // Delegate to VocabularyService for business logic
            const result = await this.vocabularyService.cloneVocabularyList(listId, userId, options);

            res.status(201).json({
                success: true,
                data: result,
                message: 'List cloned successfully'
            });

        } catch (error) {
            console.error('Clone list error:', error);
            
            if (error.message.includes('not found') || 
                error.message.includes('access denied')) {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            }

            res.status(500).json({
                success: false,
                error: 'Failed to clone list'
            });
        }
    }

    // Import vocabulary list
    async importList(req, res) {
        try {
            const userId = req.user.id;
            const importData = {
                source: req.body.source,
                data: req.body.data,
                name: req.body.name,
                mapping: req.body.mapping || {},
                options: req.body.options || {}
            };

            // Delegate to VocabularyService for business logic
            const result = await this.vocabularyService.importVocabularyList(userId, importData);

            res.status(201).json({
                success: true,
                data: result,
                message: 'List imported successfully'
            });

        } catch (error) {
            console.error('Import list error:', error);
            
            if (error.message.includes('Invalid') || 
                error.message.includes('format') ||
                error.message.includes('limit')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }

            res.status(500).json({
                success: false,
                error: 'Failed to import list'
            });
        }
    }

    // Generate examples for words
    async generateExamples(req, res) {
        try {
            const listId = req.params.listId;
            const userId = req.user.id;
            const { wordIds, options = {} } = req.body;

            // Delegate to VocabularyService for business logic
            const result = await this.vocabularyService.generateExamplesForWords(listId, wordIds, userId, options);

            res.json({
                success: true,
                data: result,
                message: 'Examples generated successfully'
            });

        } catch (error) {
            console.error('Generate examples error:', error);
            
            if (error.message.includes('not found') || 
                error.message.includes('access denied')) {
                return res.status(403).json({
                    success: false,
                    error: error.message
                });
            }

            res.status(500).json({
                success: false,
                error: 'Failed to generate examples'
            });
        }
    }

    // Get list statistics
    async getListStats(req, res) {
        try {
            const listId = req.params.id;
            const userId = req.user?.id;

            // Delegate to VocabularyService for business logic
            const result = await this.vocabularyService.getVocabularyListStats(listId, userId);

            res.json({
                success: true,
                data: result
            });

        } catch (error) {
            console.error('Get list stats error:', error);
            
            if (error.message.includes('not found') || 
                error.message.includes('access denied')) {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            }

            res.status(500).json({
                success: false,
                error: 'Failed to get list statistics'
            });
        }
    }

    // Export vocabulary list
    async exportList(req, res) {
        try {
            const listId = req.params.id;
            const userId = req.user.id;
            const format = req.query.format || 'csv';
            const options = {
                includeProgress: req.query.includeProgress === 'true',
                includeExamples: req.query.includeExamples === 'true',
                includeImages: req.query.includeImages === 'true'
            };

            // Delegate to VocabularyService for business logic
            const result = await this.vocabularyService.exportVocabularyList(listId, userId, format, options);

            // Set appropriate headers for download
            res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
            res.setHeader('Content-Type', result.contentType);

            res.send(result.data);

        } catch (error) {
            console.error('Export list error:', error);
            
            if (error.message.includes('not found') || 
                error.message.includes('access denied')) {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            }

            res.status(500).json({
                success: false,
                error: 'Failed to export list'
            });
        }
    }

    // Get validation schemas for routes
    static getValidationSchemas() {
        return {
            // List schemas
            getLists: VocabularyListSchema.getListsSchema(),
            createList: VocabularyListSchema.createSchema(),
            updateList: VocabularyListSchema.updateSchema(),
            shareList: VocabularyListSchema.shareListSchema(),
            cloneList: VocabularyListSchema.cloneListSchema(),
            importList: VocabularyListSchema.importListSchema(),
            
            // Word schemas
            addWord: VocabularyItemSchema.addWordSchema(),
            batchAddWords: VocabularyItemSchema.batchAddWordsSchema(),
            updateWord: VocabularyItemSchema.updateWordSchema(),
            searchVocabulary: VocabularyItemSchema.searchSchema(),
            generateExamples: VocabularyItemSchema.generateExamplesSchema()
        };
    }
}

module.exports = new VocabularyController();