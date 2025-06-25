const supabase = require('../config/database');

class LearningProgress {
    static async create(progressData) {
        const { data, error } = await supabase
            .from('user_vocabulary')
            .insert(progressData)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }
    
    static async findByUserAndVocab(userId, vocabularyId) {
        const { data, error } = await supabase
            .from('user_vocabulary')
            .select('*')
            .eq('user_id', userId)
            .eq('vocabulary_id', vocabularyId)
            .single();
            
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }
    
    static async findDueForReview(userId, limit = 20) {
        const { data, error } = await supabase
            .from('user_vocabulary')
            .select(`
                *,
                vocabulary:vocabulary_items(*)
            `)
            .eq('user_id', userId)
            .lte('next_review_date', new Date().toISOString())
            .order('next_review_date', { ascending: true })
            .limit(limit);
            
        if (error) throw error;
        return data;
    }
    
    static async update(userId, vocabularyId, updates) {
        const { data, error } = await supabase
            .from('user_vocabulary')
            .update(updates)
            .eq('user_id', userId)
            .eq('vocabulary_id', vocabularyId)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }
    
    static async upsert(progressData) {
        const { data, error } = await supabase
            .from('user_vocabulary')
            .upsert(progressData)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }
    
    static async getUserStats(userId) {
        const { data, error } = await supabase
            .from('user_vocabulary')
            .select('repetitions, correct_reviews, total_reviews')
            .eq('user_id', userId);
            
        if (error) throw error;
        
        const stats = {
            totalWords: data.length,
            masteredWords: data.filter(d => d.repetitions >= 5).length,
            totalReviews: data.reduce((sum, d) => sum + (d.total_reviews || 0), 0),
            correctReviews: data.reduce((sum, d) => sum + (d.correct_reviews || 0), 0)
        };
        
        stats.accuracy = stats.totalReviews > 0 
            ? Math.round((stats.correctReviews / stats.totalReviews) * 100)
            : 0;
            
        return stats;
    }
    
    static async logReview(reviewData) {
        const { data, error } = await supabase
            .from('review_history')
            .insert(reviewData)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    }
}

module.exports = LearningProgress;