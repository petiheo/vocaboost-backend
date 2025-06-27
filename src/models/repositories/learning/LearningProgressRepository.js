// models/repositories/learning/LearningProgressRepository.js
const BaseRepository = require('../base/BaseRepository');

class LearningProgressRepository extends BaseRepository {
    constructor() {
        super('user_vocabulary');
    }

    // Find learning progress for specific user and vocabulary
    async findByUserAndVocab(userId, vocabularyId) {
        return await this.findOne({
            user_id: userId,
            vocabulary_id: vocabularyId
        });
    }

    // Get all learning progress for a user
    async findByUserId(userId, options = {}) {
        const { includeVocabulary = false, limit, offset } = options;
        
        let selectString = '*';
        if (includeVocabulary) {
            selectString = `
                *,
                vocabulary:vocabulary_items(
                    id, word, meaning, difficulty_level,
                    list:vocabulary_lists(id, name)
                )
            `;
        }

        let query = this.supabase
            .from(this.tableName)
            .select(selectString)
            .eq('user_id', userId)
            .order('last_review_date', { ascending: false });

        if (limit) {
            query = query.limit(limit);
        }

        if (offset) {
            query = query.range(offset, offset + limit - 1);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }

    // Get words due for review
    async findDueForReview(userId, limit = 20) {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select(`
                *,
                vocabulary:vocabulary_items(
                    id, word, meaning, pronunciation, example_sentence, 
                    difficulty_level, image_url,
                    list:vocabulary_lists(id, name, privacy)
                )
            `)
            .eq('user_id', userId)
            .lte('next_review_date', new Date().toISOString())
            .order('next_review_date', { ascending: true })
            .limit(limit);

        if (error) throw error;
        return data || [];
    }

    // Get learning progress by vocabulary list
    async findByUserAndList(userId, listId) {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select(`
                *,
                vocabulary:vocabulary_items!inner(
                    id, word, meaning, list_id
                )
            `)
            .eq('user_id', userId)
            .eq('vocabulary.list_id', listId);

        if (error) throw error;
        return data || [];
    }

    // Create or update learning progress
    async upsert(progressData) {
        // Ensure required fields are present
        const data = {
            ...progressData,
            updated_at: new Date()
        };

        const { data: result, error } = await this.supabase
            .from(this.tableName)
            .upsert(data, { 
                onConflict: 'user_id,vocabulary_id',
                ignoreDuplicates: false 
            })
            .select()
            .single();

        if (error) throw error;
        return result;
    }

    // Initialize learning progress for new vocabulary
    async initializeProgress(userId, vocabularyId, initialData = {}) {
        const defaultData = {
            user_id: userId,
            vocabulary_id: vocabularyId,
            repetitions: 0,
            easiness_factor: 2.5,
            interval: 1,
            next_review_date: new Date(),
            last_review_date: null,
            total_reviews: 0,
            correct_reviews: 0,
            first_learned_at: new Date(),
            created_at: new Date(),
            updated_at: new Date()
        };

        return await this.create({
            ...defaultData,
            ...initialData
        });
    }

    // Get learning statistics for a user
    async getUserLearningStats(userId) {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('repetitions, correct_reviews, total_reviews, easiness_factor')
            .eq('user_id', userId);

        if (error) throw error;

        const progress = data || [];
        return {
            totalWords: progress.length,
            masteredWords: progress.filter(p => p.repetitions >= 5).length,
            learningWords: progress.filter(p => p.repetitions > 0 && p.repetitions < 5).length,
            newWords: progress.filter(p => p.repetitions === 0).length,
            totalReviews: progress.reduce((sum, p) => sum + (p.total_reviews || 0), 0),
            correctReviews: progress.reduce((sum, p) => sum + (p.correct_reviews || 0), 0),
            averageEasiness: progress.length > 0 
                ? progress.reduce((sum, p) => sum + (p.easiness_factor || 2.5), 0) / progress.length 
                : 2.5
        };
    }

    // Get words that need more practice (struggling words)
    async findStrugglingWords(userId, limit = 10) {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select(`
                *,
                vocabulary:vocabulary_items(
                    id, word, meaning, difficulty_level
                )
            `)
            .eq('user_id', userId)
            .lt('easiness_factor', 2.0) // Words with low easiness factor
            .gt('total_reviews', 2) // Words that have been reviewed multiple times
            .order('easiness_factor', { ascending: true })
            .limit(limit);

        if (error) throw error;
        return data || [];
    }

    // Get mastered words
    async findMasteredWords(userId, limit = 50) {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select(`
                *,
                vocabulary:vocabulary_items(
                    id, word, meaning, difficulty_level
                )
            `)
            .eq('user_id', userId)
            .gte('repetitions', 5) // Words with 5+ repetitions
            .gte('easiness_factor', 2.5) // Words with good easiness factor
            .order('last_review_date', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    }

    // Get learning progress summary by difficulty
    async getProgressByDifficulty(userId) {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select(`
                repetitions,
                total_reviews,
                correct_reviews,
                vocabulary:vocabulary_items(difficulty_level)
            `)
            .eq('user_id', userId);

        if (error) throw error;

        const summary = {
            beginner: { total: 0, mastered: 0, accuracy: 0 },
            intermediate: { total: 0, mastered: 0, accuracy: 0 },
            advanced: { total: 0, mastered: 0, accuracy: 0 }
        };

        (data || []).forEach(progress => {
            const difficulty = progress.vocabulary?.difficulty_level || 'intermediate';
            if (summary[difficulty]) {
                summary[difficulty].total++;
                if (progress.repetitions >= 5) {
                    summary[difficulty].mastered++;
                }
                // Calculate accuracy
                if (progress.total_reviews > 0) {
                    const accuracy = (progress.correct_reviews / progress.total_reviews) * 100;
                    summary[difficulty].accuracy = 
                        (summary[difficulty].accuracy + accuracy) / 
                        (summary[difficulty].total === 1 ? 1 : 2);
                }
            }
        });

        // Round accuracy values
        Object.keys(summary).forEach(level => {
            summary[level].accuracy = Math.round(summary[level].accuracy);
        });

        return summary;
    }

    // Delete learning progress for a vocabulary item
    async deleteByVocabularyId(vocabularyId) {
        const { error } = await this.supabase
            .from(this.tableName)
            .delete()
            .eq('vocabulary_id', vocabularyId);

        if (error) throw error;
        return true;
    }

    // Delete all learning progress for a user
    async deleteByUserId(userId) {
        const { error } = await this.supabase
            .from(this.tableName)
            .delete()
            .eq('user_id', userId);

        if (error) throw error;
        return true;
    }

    // Get words ready for next level (can be promoted)
    async findWordsReadyForPromotion(userId, limit = 20) {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select(`
                *,
                vocabulary:vocabulary_items(
                    id, word, meaning, difficulty_level
                )
            `)
            .eq('user_id', userId)
            .gte('repetitions', 3) // At least 3 successful repetitions
            .gte('easiness_factor', 2.8) // High confidence
            .lte('next_review_date', new Date().toISOString()) // Due for review
            .order('next_review_date', { ascending: true })
            .limit(limit);

        if (error) throw error;
        return data || [];
    }

    // Get learning progress trends over time
    async getLearningTrends(userId, days = 30) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('updated_at, repetitions, easiness_factor')
            .eq('user_id', userId)
            .gte('updated_at', startDate.toISOString())
            .lte('updated_at', endDate.toISOString())
            .order('updated_at', { ascending: true });

        if (error) throw error;

        // Group data by date and calculate trends
        const trends = {};
        (data || []).forEach(progress => {
            const date = new Date(progress.updated_at).toISOString().split('T')[0];
            if (!trends[date]) {
                trends[date] = {
                    date,
                    totalUpdates: 0,
                    averageRepetitions: 0,
                    averageEasiness: 0,
                    progressCount: 0
                };
            }
            
            trends[date].totalUpdates++;
            trends[date].averageRepetitions += progress.repetitions;
            trends[date].averageEasiness += progress.easiness_factor;
            trends[date].progressCount++;
        });

        // Calculate averages
        const trendArray = Object.values(trends).map(trend => ({
            ...trend,
            averageRepetitions: trend.progressCount > 0 
                ? Math.round((trend.averageRepetitions / trend.progressCount) * 100) / 100
                : 0,
            averageEasiness: trend.progressCount > 0 
                ? Math.round((trend.averageEasiness / trend.progressCount) * 100) / 100
                : 0
        }));

        return trendArray.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    // Batch update multiple progress records
    async batchUpdate(progressUpdates) {
        const updates = progressUpdates.map(update => ({
            ...update,
            updated_at: new Date()
        }));

        const { data, error } = await this.supabase
            .from(this.tableName)
            .upsert(updates, { 
                onConflict: 'user_id,vocabulary_id',
                ignoreDuplicates: false 
            })
            .select();

        if (error) throw error;
        return data || [];
    }

    // Get progress for specific vocabulary items
    async findByVocabularyIds(userId, vocabularyIds) {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('*')
            .eq('user_id', userId)
            .in('vocabulary_id', vocabularyIds);

        if (error) throw error;
        return data || [];
    }

    // Get recent learning activity
    async getRecentActivity(userId, limit = 20) {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select(`
                *,
                vocabulary:vocabulary_items(
                    id, word, meaning, difficulty_level,
                    list:vocabulary_lists(id, name)
                )
            `)
            .eq('user_id', userId)
            .not('last_review_date', 'is', null)
            .order('last_review_date', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    }

    // Calculate retention rate for a user
    async calculateRetentionRate(userId, days = 30) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('easiness_factor, last_review_date')
            .eq('user_id', userId)
            .gte('last_review_date', startDate.toISOString())
            .lte('last_review_date', endDate.toISOString());

        if (error) throw error;

        const reviews = data || [];
        if (reviews.length === 0) return 0;

        // Calculate retention based on easiness factor maintenance
        const retainedWords = reviews.filter(review => review.easiness_factor >= 2.5).length;
        return Math.round((retainedWords / reviews.length) * 100);
    }
}

module.exports = LearningProgressRepository;