// models/business-logic/core/VocabularyService.js
const VocabularyListRepository = require('../../repositories/vocabulary/VocabularyListRepository');
const VocabularyItemRepository = require('../../repositories/vocabulary/VocabularyItemRepository');
const AIService = require('../integrations/AIService');
const CacheService = require('../integrations/CacheService');

class VocabularyService {
    constructor() {
        this.vocabularyListRepository = new VocabularyListRepository();
        this.vocabularyItemRepository = new VocabularyItemRepository();
        this.aiService = new AIService();
        this.cacheService = new CacheService();
    }

    // Business logic for creating vocabulary list
    async createVocabularyList(userId, listData) {
        const { name, description, privacy = 'private', tags = [], words = [] } = listData;

        // Business rule: Validate user permissions
        if (privacy === 'public' && !await this.canCreatePublicList(userId)) {
            throw new Error('Insufficient permissions to create public list');
        }

        // Business rule: Check list limit for user
        const userListCount = await this.vocabularyListRepository.countUserLists(userId);
        const maxLists = await this.getUserListLimit(userId);
        
        if (userListCount >= maxLists) {
            throw new Error(`Maximum list limit reached (${maxLists})`);
        }

        // Business rule: Create the list
        const list = await this.vocabularyListRepository.create({
            name: name.trim(),
            description: description?.trim(),
            owner_id: userId,
            privacy,
            tags,
            is_active: true
        });

        // Business rule: Add words if provided
        if (words.length > 0) {
            await this.addWordsToList(list.id, words, userId);
        }

        // Business rule: Clear user lists cache
        await this.cacheService.del(`user_lists:${userId}`);

        return await this.vocabularyListRepository.findWithDetails(list.id);
    }

    // Business logic for adding words to list
    async addWordsToList(listId, words, userId) {
        // Business rule: Validate list ownership
        const list = await this.vocabularyListRepository.findById(listId);
        if (!list || list.owner_id !== userId) {
            throw new Error('List not found or access denied');
        }

        // Business rule: Check word limit per list
        const currentWordCount = await this.vocabularyItemRepository.countByListId(listId);
        const maxWordsPerList = 1000; // Business rule: max 1000 words per list
        
        if (currentWordCount + words.length > maxWordsPerList) {
            throw new Error(`Word limit exceeded. Maximum ${maxWordsPerList} words per list`);
        }

        const vocabularyItems = [];

        for (const wordData of words) {
            // Business rule: Generate AI example if requested and not provided
            let exampleSentence = wordData.example_sentence;
            if (!exampleSentence && wordData.generate_example) {
                try {
                    exampleSentence = await this.aiService.generateExample(wordData.word);
                } catch (aiError) {
                    console.warn('AI example generation failed:', aiError.message);
                    // Continue without AI example
                }
            }

            // Business rule: Assess difficulty if not provided
            let difficultyLevel = wordData.difficulty_level;
            if (!difficultyLevel) {
                try {
                    const assessment = await this.aiService.assessDifficultyLevel(
                        wordData.word, 
                        wordData.meaning
                    );
                    difficultyLevel = assessment.level;
                } catch (aiError) {
                    console.warn('AI difficulty assessment failed:', aiError.message);
                    difficultyLevel = 'intermediate'; // Default
                }
            }

            vocabularyItems.push({
                list_id: listId,
                word: wordData.word.trim().toLowerCase(),
                meaning: wordData.meaning.trim(),
                pronunciation: wordData.pronunciation?.trim(),
                example_sentence: exampleSentence,
                image_url: wordData.image_url,
                difficulty_level: difficultyLevel
            });
        }

        // Business rule: Check for duplicate words in the list
        const existingWords = await this.vocabularyItemRepository.findWordsByListId(listId);
        const existingWordSet = new Set(existingWords.map(w => w.word.toLowerCase()));
        
        const newItems = vocabularyItems.filter(item => 
            !existingWordSet.has(item.word.toLowerCase())
        );

        if (newItems.length === 0) {
            throw new Error('All words already exist in this list');
        }

        // Business rule: Batch insert new words
        const createdItems = await this.vocabularyItemRepository.createMany(newItems);

        // Business rule: Update list metadata
        await this.vocabularyListRepository.update(listId, {
            updated_at: new Date()
        });

        return {
            added: createdItems.length,
            skipped: vocabularyItems.length - createdItems.length,
            items: createdItems
        };
    }

    // Business logic for getting vocabulary lists
    async getVocabularyLists(userId, filters = {}) {
        const { search, tag, privacy, page = 1, limit = 20 } = filters;

        // Business rule: Build cache key
        const cacheKey = `vocab_lists:${userId}:${JSON.stringify(filters)}`;
        
        // Check cache first
        const cached = await this.cacheService.get(cacheKey);
        if (cached) {
            return cached;
        }

        // Business rule: Apply access control filters
        const accessFilters = this.buildAccessFilters(userId, privacy);

        // Business rule: Get lists with pagination
        const result = await this.vocabularyListRepository.findWithFilters({
            ...accessFilters,
            search,
            tag,
            page,
            limit
        });

        // Business rule: Enhance lists with metadata
        const enhancedLists = await this.enhanceListsWithMetadata(result.data, userId);

        const finalResult = {
            ...result,
            data: enhancedLists
        };

        // Cache for 5 minutes
        await this.cacheService.set(cacheKey, finalResult, 300);

        return finalResult;
    }

    // Business logic for searching vocabulary
    async searchVocabulary(userId, searchQuery, filters = {}) {
        const { listId, difficulty, limit = 50 } = filters;

        // Business rule: Validate search query
        if (!searchQuery || searchQuery.trim().length < 2) {
            throw new Error('Search query must be at least 2 characters');
        }

        // Business rule: Build search filters
        const searchFilters = {
            query: searchQuery.trim(),
            user_id: userId,
            list_id: listId,
            difficulty_level: difficulty,
            limit
        };

        // Business rule: Execute search
        const results = await this.vocabularyItemRepository.searchVocabulary(searchFilters);

        // Business rule: Enhance results with learning progress
        const enhancedResults = await this.enhanceWithLearningProgress(results, userId);

        return {
            query: searchQuery,
            total: enhancedResults.length,
            results: enhancedResults
        };
    }

    // Business logic for vocabulary recommendations
    async getPersonalizedRecommendations(userId, limit = 20) {
        const cacheKey = `vocab_recommendations:${userId}`;
        
        // Check cache first
        const cached = await this.cacheService.get(cacheKey);
        if (cached) {
            return cached;
        }

        // Business rule: Get user's learning statistics
        const userStats = await this.getUserLearningStats(userId);
        
        // Business rule: Get struggling words
        const strugglingWords = await this.getStrugglingWords(userId);

        // Business rule: Generate AI recommendations
        let aiRecommendations = [];
        try {
            aiRecommendations = await this.aiService.generatePersonalizedRecommendations(
                userStats,
                strugglingWords
            );
        } catch (aiError) {
            console.warn('AI recommendations failed:', aiError.message);
        }

        // Business rule: Get popular vocabulary in user's level
        const popularWords = await this.getPopularVocabularyByLevel(
            userStats.estimated_level,
            limit
        );

        // Business rule: Combine and rank recommendations
        const recommendations = this.combineRecommendations(
            aiRecommendations,
            popularWords,
            userStats
        );

        // Cache for 1 hour
        await this.cacheService.set(cacheKey, recommendations, 3600);

        return recommendations;
    }

    // Business logic for list sharing
    async shareList(listId, userId, shareOptions) {
        const { recipientEmails, message, permissions = 'view' } = shareOptions;

        // Business rule: Validate list ownership
        const list = await this.vocabularyListRepository.findById(listId);
        if (!list || list.owner_id !== userId) {
            throw new Error('List not found or access denied');
        }

        // Business rule: Validate permissions
        if (!['view', 'edit', 'clone'].includes(permissions)) {
            throw new Error('Invalid permission level');
        }

        // Business rule: Create share invitations
        const invitations = [];
        for (const email of recipientEmails) {
            const invitation = await this.createShareInvitation(
                listId,
                email,
                permissions,
                message
            );
            invitations.push(invitation);
        }

        return {
            listId,
            invitations: invitations.length,
            message: 'Share invitations sent successfully'
        };
    }

    // Helper methods for business logic

    async canCreatePublicList(userId) {
        // Business rule: Only verified users with good standing can create public lists
        const user = await this.userRepository.findById(userId);
        return user && user.email_verified && user.status === 'active';
    }

    async getUserListLimit(userId) {
        // Business rule: Different limits based on user role
        const user = await this.userRepository.findById(userId);
        switch (user?.role) {
            case 'teacher': return 100;
            case 'admin': return 1000;
            default: return 20; // learner
        }
    }

    buildAccessFilters(userId, privacy) {
        // Business rule: Access control for lists
        if (!privacy) {
            // Show public lists and user's own lists
            return {
                or_conditions: [
                    { privacy: 'public' },
                    { owner_id: userId }
                ]
            };
        } else if (privacy === 'public') {
            return { privacy: 'public' };
        } else if (privacy === 'private') {
            return { 
                privacy: 'private',
                owner_id: userId 
            };
        }
        
        return {};
    }

    async enhanceListsWithMetadata(lists, userId) {
        // Business rule: Add word count and user progress
        const enhanced = [];
        
        for (const list of lists) {
            const wordCount = await this.vocabularyItemRepository.countByListId(list.id);
            const progress = await this.getUserListProgress(list.id, userId);
            
            enhanced.push({
                ...list,
                word_count: wordCount,
                user_progress: progress
            });
        }
        
        return enhanced;
    }

    async enhanceWithLearningProgress(vocabularyItems, userId) {
        // Business rule: Add learning progress to vocabulary items
        const enhanced = [];
        
        for (const item of vocabularyItems) {
            const progress = await this.getUserWordProgress(item.id, userId);
            enhanced.push({
                ...item,
                learning_progress: progress
            });
        }
        
        return enhanced;
    }

    async getUserLearningStats(userId) {
        // Business rule: Calculate comprehensive learning statistics
        const stats = await this.vocabularyListRepository.getUserStats(userId);
        
        return {
            total_vocabulary: stats.total_vocabulary || 0,
            mastered_vocabulary: stats.mastered_vocabulary || 0,
            accuracy: stats.accuracy || 0,
            current_streak: stats.current_streak || 0,
            estimated_level: this.calculateEstimatedLevel(stats)
        };
    }

    calculateEstimatedLevel(stats) {
        // Business rule: Estimate user level based on vocabulary count and accuracy
        const { total_vocabulary, accuracy } = stats;
        
        if (total_vocabulary < 100 || accuracy < 60) return 'beginner';
        if (total_vocabulary < 500 || accuracy < 80) return 'intermediate';
        return 'advanced';
    }

    combineRecommendations(aiRecommendations, popularWords, userStats) {
        // Business rule: Intelligent recommendation combination
        const combined = [];
        
        // Prioritize AI recommendations if available
        if (aiRecommendations.length > 0) {
            combined.push(...aiRecommendations.slice(0, 10));
        }
        
        // Add popular words as fallback
        const remaining = 20 - combined.length;
        if (remaining > 0) {
            combined.push(...popularWords.slice(0, remaining));
        }
        
        return {
            recommendations: combined,
            user_level: userStats.estimated_level,
            total: combined.length
        };
    }
}

module.exports = VocabularyService;