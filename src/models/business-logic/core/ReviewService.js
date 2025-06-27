// models/business-logic/core/ReviewService.js
const LearningProgressRepository = require('../../repositories/learning/LearningProgressRepository');
const ReviewHistoryRepository = require('../../repositories/learning/ReviewHistoryRepository');
const UserStatsRepository = require('../../repositories/learning/UserStatsRepository');
const VocabularyItemRepository = require('../../repositories/vocabulary/VocabularyItemRepository');
const SpacedRepetitionService = require('../algorithms/SpacedRepetitionService');
const CacheService = require('../integrations/CacheService');

class ReviewService {
    constructor() {
        this.learningProgressRepository = new LearningProgressRepository();
        this.reviewHistoryRepository = new ReviewHistoryRepository();
        this.userStatsRepository = new UserStatsRepository();
        this.vocabularyItemRepository = new VocabularyItemRepository();
        this.spacedRepetitionService = new SpacedRepetitionService();
        this.cacheService = new CacheService();
    }

    // Business logic for getting review queue
    async getReviewQueue(userId, options = {}) {
        const { limit = 20, forceRefresh = false } = options;

        // Business rule: Check cache first (unless force refresh)
        const cacheKey = `review_queue:${userId}`;
        if (!forceRefresh) {
            const cached = await this.cacheService.get(cacheKey);
            if (cached) {
                return cached;
            }
        }

        // Business rule: Get words due for review using spaced repetition
        const dueWords = await this.spacedRepetitionService.getReviewQueue(userId, limit);

        // Business rule: If review queue is small, add new words
        let newWords = [];
        if (dueWords.length < 5) {
            newWords = await this.getNewWordsForLearning(userId, 5 - dueWords.length);
        }

        // Business rule: Enhance with learning context
        const enhancedDueWords = await this.enhanceWordsWithContext(dueWords, userId);
        const enhancedNewWords = await this.enhanceWordsWithContext(newWords, userId);

        const reviewData = {
            dueReviews: enhancedDueWords,
            newWords: enhancedNewWords,
            totalDue: enhancedDueWords.length,
            totalNew: enhancedNewWords.length,
            user: {
                dailyGoal: await this.getUserDailyGoal(userId),
                reviewsToday: await this.getReviewsToday(userId),
                currentStreak: await this.getCurrentStreak(userId)
            }
        };

        // Business rule: Cache for 5 minutes
        await this.cacheService.set(cacheKey, reviewData, 300);

        return reviewData;
    }

    // Business logic for submitting review
    async submitReview(userId, reviewData) {
        const { 
            vocabularyId, 
            performance, 
            responseTime,
            isNew = false,
            sessionId 
        } = reviewData;

        // Business rule: Validate performance score
        if (performance < 0 || performance > 3) {
            throw new Error('Performance score must be between 0 and 3');
        }

        // Business rule: Get or initialize learning progress
        let progressData = await this.learningProgressRepository.findByUserAndVocab(userId, vocabularyId);
        
        if (!progressData || isNew) {
            progressData = await this.spacedRepetitionService.initializeProgress(userId, vocabularyId);
        }

        // Business rule: Calculate next review using SM-2 algorithm
        const nextReview = this.spacedRepetitionService.calculateNextReview(progressData, performance);

        // Business rule: Update learning progress
        const updatedProgress = await this.learningProgressRepository.upsert({
            user_id: userId,
            vocabulary_id: vocabularyId,
            ...nextReview,
            last_review_date: new Date(),
            total_reviews: (progressData.total_reviews || 0) + 1,
            correct_reviews: (progressData.correct_reviews || 0) + (performance > 0 ? 1 : 0)
        });

        // Business rule: Log review history for analytics
        await this.reviewHistoryRepository.create({
            user_id: userId,
            vocabulary_id: vocabularyId,
            quality: performance,
            response_time: responseTime,
            is_correct: performance > 0,
            previous_interval: progressData.interval,
            new_interval: nextReview.interval,
            previous_easiness: progressData.easiness_factor,
            new_easiness: nextReview.easiness_factor,
            session_id: sessionId
        });

        // Business rule: Update user statistics
        await this.updateUserStats(userId);

        // Business rule: Clear review queue cache
        await this.cacheService.del(`review_queue:${userId}`);

        // Business rule: Check for achievements
        const achievements = await this.checkForAchievements(userId, performance);

        return {
            nextReviewDate: nextReview.next_review_date,
            interval: nextReview.interval,
            repetitions: nextReview.repetitions,
            easiness: nextReview.easiness_factor,
            message: this.getEncouragementMessage(performance),
            achievements,
            stats: {
                reviewsToday: await this.getReviewsToday(userId),
                accuracy: await this.getRecentAccuracy(userId),
                streak: await this.getCurrentStreak(userId)
            }
        };
    }

    // Business logic for flashcard session
    async createFlashcardSession(userId, options = {}) {
        const { listId, difficulty, limit = 20 } = options;

        // Business rule: Build session parameters
        const sessionParams = {
            user_id: userId,
            list_id: listId,
            difficulty_level: difficulty,
            limit
        };

        // Business rule: Get words for flashcard session
        const words = await this.vocabularyItemRepository.findForFlashcardSession(sessionParams);

        if (words.length === 0) {
            throw new Error('No vocabulary available for flashcard session');
        }

        // Business rule: Shuffle words for better learning
        const shuffledWords = this.shuffleArray(words);

        // Business rule: Enhance with learning progress
        const enhancedWords = await Promise.all(
            shuffledWords.map(async (word) => {
                const progress = await this.learningProgressRepository.findByUserAndVocab(userId, word.id);
                return {
                    ...word,
                    progress: progress ? {
                        repetitions: progress.repetitions,
                        easiness_factor: progress.easiness_factor,
                        last_review_date: progress.last_review_date,
                        mastery_level: this.calculateMasteryLevel(progress)
                    } : null
                };
            })
        );

        return {
            sessionId: this.generateSessionId(),
            words: enhancedWords,
            total: enhancedWords.length,
            sessionType: 'flashcard',
            options: {
                showDefinition: true,
                showExample: true,
                autoAdvance: false
            }
        };
    }

    // Business logic for fill-in-blank session
    async createFillInBlankSession(userId, options = {}) {
        const { listId, difficulty = 'all', limit = 10 } = options;

        // Business rule: Get words with example sentences
        const words = await this.vocabularyItemRepository.findWithExampleSentences({
            user_id: userId,
            list_id: listId,
            difficulty_level: difficulty !== 'all' ? difficulty : null,
            limit
        });

        if (words.length < 4) {
            throw new Error('Need at least 4 words with example sentences to create fill-in-blank exercises');
        }

        // Business rule: Generate fill-in-blank exercises
        const exercises = words.map(word => {
            const sentence = word.example_sentence;
            const wordRegex = new RegExp(`\\b${word.word}\\b`, 'gi');
            const blankedSentence = sentence.replace(wordRegex, '_____');
            
            // Business rule: Create hint (first letter + ...)
            const hint = word.word.length > 1 
                ? word.word.substring(0, 1) + '...' 
                : word.word;

            return {
                id: word.id,
                word: word.word,
                meaning: word.meaning,
                originalSentence: sentence,
                blankedSentence: blankedSentence,
                hint: hint,
                difficulty: word.difficulty_level
            };
        });

        return {
            sessionId: this.generateSessionId(),
            exercises: exercises,
            total: exercises.length,
            sessionType: 'fill-in-blank',
            options: {
                showHint: true,
                caseSensitive: false,
                allowPartialCredit: true
            }
        };
    }

    // Business logic for word association session
    async createWordAssociationSession(userId, options = {}) {
        const { listId, limit = 10 } = options;

        // Business rule: Get words for association
        const words = await this.vocabularyItemRepository.findForAssociationGame({
            user_id: userId,
            list_id: listId,
            limit: limit * 4 // Get more for distractors
        });

        if (words.length < 4) {
            throw new Error('Need at least 4 words to create word association exercises');
        }

        // Business rule: Create association exercises
        const associations = [];
        const usedWords = new Set();

        for (let i = 0; i < Math.min(limit, Math.floor(words.length / 4)); i++) {
            const targetWord = words[i];
            if (!usedWords.has(targetWord.id)) {
                usedWords.add(targetWord.id);

                // Business rule: Get distractors (wrong options)
                const distractors = words
                    .filter(w => w.id !== targetWord.id && !usedWords.has(w.id))
                    .slice(0, 3)
                    .map(w => {
                        usedWords.add(w.id);
                        return {
                            id: w.id,
                            text: w.meaning,
                            isCorrect: false
                        };
                    });

                // Business rule: Shuffle options
                const options = [
                    { id: targetWord.id, text: targetWord.meaning, isCorrect: true },
                    ...distractors
                ].sort(() => Math.random() - 0.5);

                associations.push({
                    wordId: targetWord.id,
                    word: targetWord.word,
                    options: options,
                    difficulty: targetWord.difficulty_level
                });
            }
        }

        return {
            sessionId: this.generateSessionId(),
            associations: associations,
            total: associations.length,
            sessionType: 'word-association',
            options: {
                timePerQuestion: 15000, // 15 seconds
                showCorrectAnswer: true,
                randomizeOptions: true
            }
        };
    }

    // Business logic for learning statistics
    async getLearningStats(userId, period = '7d') {
        const cacheKey = `learning_stats:${userId}:${period}`;
        
        // Check cache first
        const cached = await this.cacheService.get(cacheKey);
        if (cached) {
            return cached;
        }

        // Business rule: Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        switch(period) {
            case '24h': startDate.setDate(startDate.getDate() - 1); break;
            case '7d': startDate.setDate(startDate.getDate() - 7); break;
            case '30d': startDate.setDate(startDate.getDate() - 30); break;
            case 'all': startDate.setFullYear(2020); break;
        }

        // Business rule: Get review history
        const reviews = await this.reviewHistoryRepository.findByUserAndDateRange(
            userId, 
            startDate, 
            endDate
        );

        // Business rule: Get user stats
        const userStats = await this.userStatsRepository.findByUserId(userId);

        // Business rule: Calculate comprehensive statistics
        const stats = {
            period: period,
            totalReviews: reviews.length,
            correctReviews: reviews.filter(r => r.is_correct).length,
            accuracy: reviews.length > 0 
                ? Math.round((reviews.filter(r => r.is_correct).length / reviews.length) * 100)
                : 0,
            averageResponseTime: reviews.length > 0
                ? Math.round(reviews.reduce((sum, r) => sum + (r.response_time || 0), 0) / reviews.length)
                : 0,
            currentStreak: userStats?.current_streak || 0,
            longestStreak: userStats?.longest_streak || 0,
            totalVocabulary: userStats?.total_vocabulary || 0,
            masteredVocabulary: userStats?.mastered_vocabulary || 0,
            dailyBreakdown: this.calculateDailyBreakdown(reviews),
            performanceByDifficulty: this.calculatePerformanceByDifficulty(reviews),
            weakestAreas: await this.identifyWeakestAreas(userId),
            recentAchievements: await this.getRecentAchievements(userId)
        };

        // Cache for 10 minutes
        await this.cacheService.set(cacheKey, stats, 600);

        return stats;
    }

    // Business logic for setting daily goal
    async setDailyGoal(userId, goal) {
        if (goal < 1 || goal > 100) {
            throw new Error('Daily goal must be between 1 and 100');
        }

        await this.userStatsRepository.updateSettings(userId, { daily_goal: goal });
        
        // Clear relevant caches
        await this.cacheService.del(`review_queue:${userId}`);
        await this.cacheService.del(`learning_stats:${userId}:*`);

        return { goal, message: 'Daily goal updated successfully' };
    }

    // Helper methods for business logic

    async getNewWordsForLearning(userId, limit) {
        return await this.vocabularyItemRepository.findNewWordsForUser(userId, limit);
    }

    async enhanceWordsWithContext(words, userId) {
        return await Promise.all(
            words.map(async (word) => {
                const context = await this.getWordLearningContext(word.vocabulary_id || word.id, userId);
                return { ...word, context };
            })
        );
    }

    async getWordLearningContext(vocabularyId, userId) {
        const progress = await this.learningProgressRepository.findByUserAndVocab(userId, vocabularyId);
        return {
            timesReviewed: progress?.total_reviews || 0,
            lastReviewDate: progress?.last_review_date,
            difficulty: this.calculatePerceivedDifficulty(progress),
            mastery: this.calculateMasteryLevel(progress)
        };
    }

    async getUserDailyGoal(userId) {
        const settings = await this.userStatsRepository.getUserSettings(userId);
        return settings?.daily_goal || 10;
    }

    async getReviewsToday(userId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        return await this.reviewHistoryRepository.countByUserAndDateRange(userId, today, tomorrow);
    }

    async getCurrentStreak(userId) {
        return await this.userStatsRepository.calculateCurrentStreak(userId);
    }

    async getRecentAccuracy(userId, days = 7) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const reviews = await this.reviewHistoryRepository.findByUserAndDateRange(userId, startDate, endDate);
        
        if (reviews.length === 0) return 0;
        
        const correctReviews = reviews.filter(r => r.is_correct).length;
        return Math.round((correctReviews / reviews.length) * 100);
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    calculateMasteryLevel(progress) {
        if (!progress) return 'new';
        if (progress.repetitions >= 5 && progress.easiness_factor >= 2.5) return 'mastered';
        if (progress.repetitions >= 3) return 'familiar';
        if (progress.repetitions >= 1) return 'learning';
        return 'new';
    }

    calculatePerceivedDifficulty(progress) {
        if (!progress) return 'unknown';
        if (progress.easiness_factor < 2.0) return 'hard';
        if (progress.easiness_factor < 2.5) return 'medium';
        return 'easy';
    }

    calculateDailyBreakdown(reviews) {
        const breakdown = {};
        
        reviews.forEach(review => {
            const date = new Date(review.reviewed_at).toISOString().split('T')[0];
            if (!breakdown[date]) {
                breakdown[date] = { total: 0, correct: 0 };
            }
            breakdown[date].total++;
            if (review.is_correct) {
                breakdown[date].correct++;
            }
        });
        
        return Object.entries(breakdown).map(([date, stats]) => ({
            date,
            total: stats.total,
            correct: stats.correct,
            accuracy: Math.round((stats.correct / stats.total) * 100)
        }));
    }

    calculatePerformanceByDifficulty(reviews) {
        const performance = {
            beginner: { total: 0, correct: 0 },
            intermediate: { total: 0, correct: 0 },
            advanced: { total: 0, correct: 0 }
        };

        reviews.forEach(review => {
            const difficulty = review.vocabulary?.difficulty_level || 'intermediate';
            if (performance[difficulty]) {
                performance[difficulty].total++;
                if (review.is_correct) {
                    performance[difficulty].correct++;
                }
            }
        });

        Object.keys(performance).forEach(level => {
            const stats = performance[level];
            stats.accuracy = stats.total > 0 
                ? Math.round((stats.correct / stats.total) * 100) 
                : 0;
        });

        return performance;
    }

    getEncouragementMessage(performance) {
        const messages = {
            0: ['Keep going! Every mistake is a learning opportunity! 💪', 'Don\'t give up! You\'re building your vocabulary! 📚'],
            1: ['Good effort! You\'re making progress! 👍', 'Getting better! Keep practicing! ✨'],
            2: ['Well done! You\'re doing great! 🎉', 'Excellent work! Your effort is paying off! ⭐'],
            3: ['Outstanding! You\'ve mastered this word! 🏆', 'Perfect! You\'re a vocabulary champion! 🥇']
        };
        
        const messageArray = messages[performance] || messages[2];
        return messageArray[Math.floor(Math.random() * messageArray.length)];
    }

    async updateUserStats(userId) {
        // This will be implemented to update comprehensive user statistics
        await this.userStatsRepository.recalculateStats(userId);
    }

    async checkForAchievements(userId, performance) {
        // This will be implemented to check for new achievements
        return [];
    }

    async identifyWeakestAreas(userId) {
        // This will be implemented to identify areas needing improvement
        return [];
    }

    async getRecentAchievements(userId) {
        // This will be implemented to get recent achievements
        return [];
    }
}

module.exports = ReviewService;