// services/AIService.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

class AIService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    });
  }

  // Tạo định nghĩa và ví dụ cho từ vựng mới
  async generateVocabularyDefinition(word, context = '') {
    try {
      const prompt = `
        Tạo định nghĩa chi tiết cho từ tiếng Anh "${word}" ${context ? `trong ngữ cảnh: ${context}` : ''}.
        
        Yêu cầu trả về JSON format:
        {
          "word": "${word}",
          "pronunciation": "phiên âm IPA",
          "partOfSpeech": "từ loại",
          "definition": "định nghĩa tiếng Việt chi tiết",
          "englishDefinition": "định nghĩa tiếng Anh",
          "examples": [
            {
              "english": "câu ví dụ tiếng Anh",
              "vietnamese": "dịch tiếng Việt"
            }
          ],
          "synonyms": ["từ đồng nghĩa"],
          "antonyms": ["từ trái nghĩa"],
          "difficultyLevel": "beginner/intermediate/advanced",
          "commonMistakes": ["lỗi thường gặp khi sử dụng từ này"]
        }
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('Could not parse AI response');
    } catch (error) {
      console.error('AI Service Error:', error);
      throw new Error('Lỗi khi tạo định nghĩa từ vựng: ' + error.message);
    }
  }

  // Đánh giá độ khó của từ vựng
  async assessDifficultyLevel(word, definition) {
    try {
      const prompt = `
        Đánh giá độ khó của từ tiếng Anh "${word}" với định nghĩa: "${definition}"
        
        Tiêu chí đánh giá:
        - beginner: từ cơ bản, thường gặp hàng ngày
        - intermediate: từ trung bình, cần một chút kinh nghiệm
        - advanced: từ khó, chuyên môn hoặc ít gặp
        
        Trả về JSON: {"level": "beginner/intermediate/advanced", "reasoning": "lý do đánh giá"}
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return { level: 'intermediate', reasoning: 'Default assessment' };
    } catch (error) {
      console.error('Difficulty assessment error:', error);
      return { level: 'intermediate', reasoning: 'Error in assessment' };
    }
  }

  // Tạo gợi ý học tập cá nhân hóa
  async generatePersonalizedRecommendations(userStats, strugglingWords) {
    try {
      const prompt = `
        Tạo gợi ý học tập cá nhân hóa cho học sinh với thống kê:
        - Tổng từ vựng: ${userStats.totalVocabulary}
        - Độ chính xác: ${userStats.accuracy}%
        - Streak hiện tại: ${userStats.currentStreak} ngày
        - Từ khó nhất: ${strugglingWords.slice(0, 5).map(w => w.word).join(', ')}
        
        Trả về JSON:
        {
          "recommendations": [
            {
              "type": "study_schedule/review_strategy/motivation",
              "title": "tiêu đề gợi ý",
              "description": "mô tả chi tiết",
              "action": "hành động cụ thể"
            }
          ],
          "dailyGoalSuggestion": số_từ_nên_học_mỗi_ngày,
          "focusAreas": ["lĩnh vực cần tập trung"],
          "motivationalMessage": "tin nhắn động viên"
        }
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('Could not parse recommendations');
    } catch (error) {
      console.error('Recommendations error:', error);
      return {
        recommendations: [{
          type: 'motivation',
          title: 'Tiếp tục cố gắng',
          description: 'Bạn đang làm rất tốt, hãy duy trì việc học hàng ngày',
          action: 'Học ít nhất 5 từ mỗi ngày'
        }],
        dailyGoalSuggestion: 10,
        focusAreas: ['từ vựng cơ bản'],
        motivationalMessage: 'Kiên trì sẽ đạt được thành công!'
      };
    }
  }

  // Tạo câu hỏi trắc nghiệm từ từ vựng
  async generateQuizQuestions(vocabularyList, questionType = 'multiple_choice') {
    try {
      const words = vocabularyList.slice(0, 10); // Limit to 10 words
      const wordsText = words.map(w => `"${w.word}": ${w.definition}`).join('\n');
      
      const prompt = `
        Tạo 5 câu hỏi trắc nghiệm từ danh sách từ vựng:
        ${wordsText}
        
        Loại câu hỏi: ${questionType}
        
        Trả về JSON:
        {
          "questions": [
            {
              "question": "câu hỏi",
              "options": ["A", "B", "C", "D"],
              "correctAnswer": 0,
              "explanation": "giải thích đáp án đúng",
              "word": "từ vựng liên quan"
            }
          ]
        }
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('Could not generate quiz questions');
    } catch (error) {
      console.error('Quiz generation error:', error);
      return { questions: [] };
    }
  }

  // Rate limiting and error handling
  async callWithRetry(fn, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (error.message.includes('rate limit') && i < maxRetries - 1) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
          continue;
        }
        throw error;
      }
    }
  }
}

module.exports = AIService;