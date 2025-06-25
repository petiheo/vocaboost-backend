    const supabase = require('../config/database');
const spacedRepetition = require('../services/spacedRepetition');
const cacheService = require('../services/cacheService');

class ReviewController {
    // USC4: Review vocabulary with Spaced Repetition
    async getReviewQueue(req, res) {
        try {
            const userId = req.user.id;
            const { limit = 20 } = req.query;
            
            // Check cache first
            const cacheKey = `review_queue:${userId}`;
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                return res.json({ success: true, data: cached });
            }
            
            // Get words due for review
            const { data: dueWords, error } = await supabase
                .from('user_vocabulary')
                .select(`
                    id,
                    vocabulary_id,
                    repetitions,
                    easiness_factor,
                    interval,
                    next_review_date,
                    vocabulary:vocabulary_items(
                        id,
                        word,
                        meaning,
                        pronunciation,
                        example_sentence,
                        image_url,
                        list:vocabulary_lists(name)
                    )
                `)
                .eq('user_id', userId)
                .lte('next_review_date', new Date().toISOString())
                .order('next_review_date', { ascending: true })
                .limit(limit);
                
            if (error) throw error;
            
            // Get new words if review queue is small
            let newWords = [];
            if (dueWords.length < 5) {
                const { data: unlearnedWords, error: newError } = await supabase
                    .from('vocabulary_items')
                    .select(`
                        id,
                        word,
                        meaning,
                        pronunciation,
                        example_sentence,
                        image_url,
                        list:vocabulary_lists(name)
                    `)
                    .not('id', 'in', 
                        `(SELECT vocabulary_id FROM user_vocabulary WHERE user_id = '${userId}')`
                    )
                    .limit(5);
                    
                if (!newError && unlearnedWords) {
                    newWords = unlearnedWords;
                }
            }
            
            const reviewData = {
                dueReviews: dueWords,
                newWords: newWords,
                totalDue: dueWords.length,
                totalNew: newWords.length
            };
            
            // Cache for 5 minutes
            await cacheService.set(cacheKey, reviewData, 300);
            
            res.json({
                success: true,
                data: reviewData
            });
            
        } catch (error) {
            console.error('Get review queue error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể lấy danh sách ôn tập'
            });
        }
    }
    
    // Submit review result and calculate next review
    async submitReview(req, res) {
        try {
            const userId = req.user.id;
            const { 
                vocabularyId, 
                performance, // 0: Again, 1: Hard, 2: Good, 3: Easy
                responseTime,
                isNew = false 
            } = req.body;
            
            // Begin transaction
            const { data: currentProgress, error: fetchError } = await supabase
                .from('user_vocabulary')
                .select('*')
                .eq('user_id', userId)
                .eq('vocabulary_id', vocabularyId)
                .single();
                
            let progressData;
            
            if (!currentProgress || isNew) {
                // Initialize new word
                progressData = await spacedRepetition.initializeProgress(userId, vocabularyId);
            } else {
                progressData = currentProgress;
            }
            
            // Calculate next review using SM-2
            const nextReview = spacedRepetition.calculateNextReview(progressData, performance);
            
            // Update user_vocabulary
            const { error: updateError } = await supabase
                .from('user_vocabulary')
                .upsert({
                    user_id: userId,
                    vocabulary_id: vocabularyId,
                    ...nextReview,
                    last_review_date: new Date(),
                    total_reviews: (progressData.total_reviews || 0) + 1,
                    correct_reviews: (progressData.correct_reviews || 0) + (performance > 0 ? 1 : 0)
                });
                
            if (updateError) throw updateError;
            
            // Log review history
            const { error: historyError } = await supabase
                .from('review_history')
                .insert({
                    user_id: userId,
                    vocabulary_id: vocabularyId,
                    quality: performance,
                    response_time: responseTime,
                    is_correct: performance > 0,
                    previous_interval: progressData.interval,
                    new_interval: nextReview.interval,
                    previous_easiness: progressData.easiness_factor,
                    new_easiness: nextReview.easiness_factor
                });
                
            if (historyError) throw historyError;
            
            // Update user stats
            await this.updateUserStats(userId);
            
            // Clear cache
            await cacheService.del(`review_queue:${userId}`);
            
            res.json({
                success: true,
                data: {
                    nextReviewDate: nextReview.nextReviewDate,
                    interval: nextReview.interval,
                    repetitions: nextReview.repetitions,
                    message: this.getEncouragementMessage(performance)
                }
            });
            
        } catch (error) {
            console.error('Submit review error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể lưu kết quả ôn tập'
            });
        }
    }
    
    // USC5: Review with Flashcard
    async getFlashcardSession(req, res) {
        try {
            const userId = req.user.id;
            const { listId, limit = 20 } = req.query;
            
            let query = supabase
                .from('vocabulary_items')
                .select(`
                    *,
                    list:vocabulary_lists(name),
                    progress:user_vocabulary!left(
                        repetitions,
                        easiness_factor,
                        last_review_date
                    )
                `);
                
            if (listId) {
                query = query.eq('list_id', listId);
            }
            
            const { data: words, error } = await query.limit(limit);
            
            if (error) throw error;
            
            // Shuffle words for flashcard
            const shuffled = words.sort(() => Math.random() - 0.5);
            
            res.json({
                success: true,
                data: {
                    words: shuffled,
                    total: shuffled.length,
                    sessionType: 'flashcard'
                }
            });
            
        } catch (error) {
            console.error('Get flashcard session error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể tạo phiên flashcard'
            });
        }
    }
    
    // USC6: Review with Fill-in-blank
    async getFillInBlankSession(req, res) {
        try {
            const userId = req.user.id;
            const { listId, difficulty = 'all', limit = 10 } = req.query;
            
            // Get words with example sentences
            let query = supabase
                .from('vocabulary_items')
                .select('*')
                .not('example_sentence', 'is', null);
                
            if (listId) {
                query = query.eq('list_id', listId);
            }
            
            if (difficulty !== 'all') {
                query = query.eq('difficulty_level', difficulty);
            }
            
            const { data: words, error } = await query.limit(limit);
            
            if (error) throw error;
            
            // Generate fill-in-blank exercises
            const exercises = words.map(word => {
                const sentence = word.example_sentence;
                const wordRegex = new RegExp(`\\b${word.word}\\b`, 'gi');
                const blankedSentence = sentence.replace(wordRegex, '_____');
                
                return {
                    id: word.id,
                    word: word.word,
                    meaning: word.meaning,
                    originalSentence: sentence,
                    blankedSentence: blankedSentence,
                    hint: word.word.substring(0, 1) + '...'
                };
            });
            
            res.json({
                success: true,
                data: {
                    exercises: exercises,
                    total: exercises.length,
                    sessionType: 'fill-in-blank'
                }
            });
            
        } catch (error) {
            console.error('Get fill-in-blank session error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể tạo bài tập điền từ'
            });
        }
    }
    
    // USC7: Review with Word Association
    async getWordAssociationSession(req, res) {
        try {
            const userId = req.user.id;
            const { listId, limit = 10 } = req.query;
            
            let query = supabase
                .from('vocabulary_items')
                .select('id, word, meaning, image_url');
                
            if (listId) {
                query = query.eq('list_id', listId);
            }
            
            const { data: words, error } = await query.limit(limit * 2); // Get more for distractors
            
            if (error) throw error;
            
            if (words.length < 4) {
                return res.status(400).json({
                    success: false,
                    error: 'Cần ít nhất 4 từ để tạo bài tập ghép từ'
                });
            }
            
            // Create word pairs and distractors
            const associations = [];
            const usedWords = new Set();
            
            for (let i = 0; i < Math.min(limit, words.length / 2); i++) {
                const word = words[i];
                if (!usedWords.has(word.id)) {
                    usedWords.add(word.id);
                    
                    // Get distractors (wrong options)
                    const distractors = words
                        .filter(w => w.id !== word.id && !usedWords.has(w.id))
                        .slice(0, 3)
                        .map(w => ({
                            id: w.id,
                            text: w.meaning,
                            isCorrect: false
                        }));
                    
                    associations.push({
                        wordId: word.id,
                        word: word.word,
                        options: [
                            { id: word.id, text: word.meaning, isCorrect: true },
                            ...distractors
                        ].sort(() => Math.random() - 0.5)
                    });
                }
            }
            
            res.json({
                success: true,
                data: {
                    associations: associations,
                    total: associations.length,
                    sessionType: 'word-association'
                }
            });
            
        } catch (error) {
            console.error('Get word association session error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể tạo bài tập ghép từ'
            });
        }
    }
    
    // Get learning statistics
    async getLearningStats(req, res) {
        try {
            const userId = req.user.id;
            const { period = '7d' } = req.query;
            
            // Get date range
            const endDate = new Date();
            const startDate = new Date();
            switch(period) {
                case '24h': startDate.setDate(startDate.getDate() - 1); break;
                case '7d': startDate.setDate(startDate.getDate() - 7); break;
                case '30d': startDate.setDate(startDate.getDate() - 30); break;
                case 'all': startDate.setFullYear(2020); break;
            }
            
            // Get review history
            const { data: reviews, error: reviewError } = await supabase
                .from('review_history')
                .select('*')
                .eq('user_id', userId)
                .gte('reviewed_at', startDate.toISOString())
                .lte('reviewed_at', endDate.toISOString());
                
            if (reviewError) throw reviewError;
            
            // Get user stats
            const { data: userStats, error: statsError } = await supabase
                .from('user_stats')
                .select('*')
                .eq('user_id', userId)
                .single();
                
            if (statsError) throw statsError;
            
            // Calculate statistics
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
                dailyBreakdown: this.calculateDailyBreakdown(reviews)
            };
            
            res.json({
                success: true,
                data: stats
            });
            
        } catch (error) {
            console.error('Get learning stats error:', error);
            res.status(500).json({
                success: false,
                error: 'Không thể lấy thống kê học tập'
            });
        }
    }

    // Set daily review goal
    async setDailyGoal(req, res) {
        try {
            const userId = req.user.id;
            const { goal } = req.body;

            const { error } = await supabase
                .from('user_settings')
                .upsert({ user_id: userId, daily_goal: goal, updated_at: new Date() });

            if (error) throw error;

            res.json({ success: true, message: 'Đã cập nhật mục tiêu ngày' });
        } catch (error) {
            console.error('Set daily goal error:', error);
            res.status(500).json({ success: false, error: 'Không thể đặt mục tiêu' });
        }
    }

    // Get streak information
    async getStreakInfo(req, res) {
        try {
            const userId = req.user.id;
            const { data: stats, error } = await supabase
                .from('user_stats')
                .select('current_streak, longest_streak')
                .eq('user_id', userId)
                .single();

            if (error) throw error;

            res.json({ success: true, data: stats || { current_streak: 0, longest_streak: 0 } });
        } catch (error) {
            console.error('Get streak info error:', error);
            res.status(500).json({ success: false, error: 'Không thể lấy chuỗi ngày' });
        }
    }
    
    // Helper methods
    async updateUserStats(userId) {
        try {
            // Get all vocabulary progress
            const { data: progress } = await supabase
                .from('user_vocabulary')
                .select('repetitions')
                .eq('user_id', userId);
                
            const totalVocabulary = progress?.length || 0;
            const masteredVocabulary = progress?.filter(p => p.repetitions >= 5).length || 0;
            
            // Get review stats
            const { data: reviews } = await supabase
                .from('review_history')
                .select('is_correct, reviewed_at')
                .eq('user_id', userId);
                
            const totalReviews = reviews?.length || 0;
            const correctReviews = reviews?.filter(r => r.is_correct).length || 0;
            
            // Calculate streak
            const currentStreak = await this.calculateStreak(userId);
            
            // Update user_stats
            await supabase
                .from('user_stats')
                .upsert({
                    user_id: userId,
                    total_vocabulary: totalVocabulary,
                    mastered_vocabulary: masteredVocabulary,
                    total_reviews: totalReviews,
                    correct_reviews: correctReviews,
                    current_streak: currentStreak,
                    last_review_date: new Date()
                });
                
        } catch (error) {
            console.error('Update user stats error:', error);
        }
    }
    
    async calculateStreak(userId) {
        const { data: reviews } = await supabase
            .from('review_history')
            .select('reviewed_at')
            .eq('user_id', userId)
            .order('reviewed_at', { ascending: false })
            .limit(100);
            
        if (!reviews || reviews.length === 0) return 0;
        
        let streak = 1;
        let currentDate = new Date(reviews[0].reviewed_at);
        currentDate.setHours(0, 0, 0, 0);
        
        for (let i = 1; i < reviews.length; i++) {
            const reviewDate = new Date(reviews[i].reviewed_at);
            reviewDate.setHours(0, 0, 0, 0);
            
            const dayDiff = Math.floor((currentDate - reviewDate) / (1000 * 60 * 60 * 24));
            
            if (dayDiff === 1) {
                streak++;
                currentDate = reviewDate;
            } else if (dayDiff > 1) {
                break;
            }
        }
        
        return streak;
    }
    
    calculateDailyBreakdown(reviews) {
        const breakdown = {};
        
        reviews.forEach(review => {
            const date = new Date(review.reviewed_at).toISOString().split('T')[0];
            if (!breakdown[date]) {
                breakdown[date] = {
                    total: 0,
                    correct: 0
                };
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
    
    getEncouragementMessage(performance) {
        const messages = {
            0: 'Đừng lo, luyện tập nhiều sẽ nhớ thôi! 💪',
            1: 'Khá hơn rồi đó, cố gắng thêm nhé! 📚',
            2: 'Tốt lắm! Bạn đang tiến bộ đấy! ✨',
            3: 'Xuất sắc! Bạn đã thuộc từ này rồi! 🎉'
        };
        return messages[performance] || 'Tiếp tục cố gắng nhé!';
    }
}

module.exports = new ReviewController();