// SM-2 Algorithm implementation
class SpacedRepetitionService {
    // Calculate next review date based on SM-2 algorithm
    calculateNextReview(currentData, performance) {
        // Performance ratings: 
        // 0 - Again, 1 - Hard, 2 - Good, 3 - Easy
        
        let { easinessFactor = 2.5, repetitions = 0, interval = 1 } = currentData;
        
        // Update easiness factor
        easinessFactor = this.calculateEasinessFactor(easinessFactor, performance);
        
        // Calculate new interval
        if (performance === 0) {
            // Failed - reset
            repetitions = 0;
            interval = 1;
        } else if (repetitions === 0) {
            // First successful review
            interval = 1;
            repetitions = 1;
        } else if (repetitions === 1) {
            // Second successful review
            interval = 6;
            repetitions = 2;
        } else {
            // Subsequent reviews
            interval = Math.round(interval * easinessFactor);
            repetitions += 1;
        }
        
        // Calculate next review date
        const nextReviewDate = new Date();
        nextReviewDate.setDate(nextReviewDate.getDate() + interval);
        
        return {
            easinessFactor,
            repetitions,
            interval,
            nextReviewDate
        };
    }
    
    calculateEasinessFactor(currentEF, performance) {
        // SM-2 formula for easiness factor
        const newEF = currentEF + (0.1 - (3 - performance) * (0.08 + (3 - performance) * 0.02));
        
        // Minimum EF is 1.3
        return Math.max(1.3, newEF);
    }
    
    // Get words due for review
    async getReviewQueue(userId, limit = 20) {
        const supabase = require('../config/database');
        
        try {
            // Get all user's learning progress
            const { data: progress, error } = await supabase
                .from('learning_progress')
                .select(`
                    *,
                    word:vocabulary_items(
                        *,
                        list:vocabulary_lists(name)
                    )
                `)
                .eq('user_id', userId)
                .lte('next_review_date', new Date().toISOString())
                .order('next_review_date', { ascending: true })
                .limit(limit);
                
            if (error) throw error;
            
            return progress || [];
            
        } catch (error) {
            console.error('Get review queue error:', error);
            throw error;
        }
    }
    
    // Initialize learning progress for new words
    async initializeProgress(userId, wordId) {
        const supabase = require('../config/database');
        
        try {
            const { data, error } = await supabase
                .from('learning_progress')
                .insert({
                    user_id: userId,
                    word_id: wordId,
                    easiness_factor: 2.5,
                    repetitions: 0,
                    interval: 1,
                    next_review_date: new Date(),
                    last_reviewed: null,
                    correct_count: 0,
                    total_reviews: 0
                })
                .select()
                .single();
                
            if (error) throw error;
            
            return data;
            
        } catch (error) {
            console.error('Initialize progress error:', error);
            throw error;
        }
    }
}

module.exports = new SpacedRepetitionService();