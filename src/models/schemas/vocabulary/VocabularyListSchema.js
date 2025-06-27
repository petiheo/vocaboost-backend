// models/schemas/vocabulary/VocabularyListSchema.js
const { body, param, query, validationResult } = require('express-validator');
const CommonSchema = require('../common/CommonSchema');

class VocabularyListSchema extends CommonSchema {
    
    // Create vocabulary list validation
    static createSchema() {
        return [
            body('name')
                .trim()
                .isLength({ min: 1, max: 200 })
                .withMessage('List name must be between 1-200 characters')
                .matches(/^[a-zA-Z0-9À-ÿ\s\-_.,!?()]+$/)
                .withMessage('List name contains invalid characters'),
            
            body('description')
                .optional()
                .trim()
                .isLength({ max: 1000 })
                .withMessage('Description must not exceed 1000 characters'),
            
            body('privacy')
                .optional()
                .isIn(['private', 'public', 'shared'])
                .withMessage('Privacy must be private, public, or shared'),
            
            body('tags')
                .optional()
                .isArray({ max: 10 })
                .withMessage('Maximum 10 tags allowed'),
            
            body('tags.*')
                .optional()
                .trim()
                .isLength({ min: 1, max: 50 })
                .withMessage('Each tag must be between 1-50 characters')
                .matches(/^[a-zA-Z0-9À-ÿ\s\-_]+$/)
                .withMessage('Tags can only contain letters, numbers, spaces, hyphens, and underscores'),
            
            body('difficulty')
                .optional()
                .isIn(['beginner', 'intermediate', 'advanced', 'mixed'])
                .withMessage('Difficulty must be beginner, intermediate, advanced, or mixed'),
            
            body('language')
                .optional()
                .isIn(['en', 'vi', 'fr', 'de', 'ja', 'ko', 'es', 'it'])
                .withMessage('Unsupported language'),
            
            body('words')
                .optional()
                .isArray({ max: 1000 })
                .withMessage('Maximum 1000 words per list'),
            
            this.handleValidationErrors
        ];
    }

    // Update vocabulary list validation
    static updateSchema() {
        return [
            param('id')
                .isUUID()
                .withMessage('Invalid list ID format'),
            
            body('name')
                .optional()
                .trim()
                .isLength({ min: 1, max: 200 })
                .withMessage('List name must be between 1-200 characters')
                .matches(/^[a-zA-Z0-9À-ÿ\s\-_.,!?()]+$/)
                .withMessage('List name contains invalid characters'),
            
            body('description')
                .optional()
                .trim()
                .isLength({ max: 1000 })
                .withMessage('Description must not exceed 1000 characters'),
            
            body('privacy')
                .optional()
                .isIn(['private', 'public', 'shared'])
                .withMessage('Privacy must be private, public, or shared'),
            
            body('tags')
                .optional()
                .isArray({ max: 10 })
                .withMessage('Maximum 10 tags allowed'),
            
            body('tags.*')
                .optional()
                .trim()
                .isLength({ min: 1, max: 50 })
                .withMessage('Each tag must be between 1-50 characters'),
            
            this.handleValidationErrors
        ];
    }

    // Get vocabulary lists validation
    static getListsSchema() {
        return [
            query('search')
                .optional()
                .trim()
                .isLength({ min: 1, max: 100 })
                .withMessage('Search query must be between 1-100 characters'),
            
            query('tag')
                .optional()
                .trim()
                .isLength({ min: 1, max: 50 })
                .withMessage('Tag must be between 1-50 characters'),
            
            query('privacy')
                .optional()
                .isIn(['private', 'public', 'shared'])
                .withMessage('Privacy filter must be private, public, or shared'),
            
            query('difficulty')
                .optional()
                .isIn(['beginner', 'intermediate', 'advanced', 'mixed'])
                .withMessage('Difficulty filter must be beginner, intermediate, advanced, or mixed'),
            
            query('language')
                .optional()
                .isIn(['en', 'vi', 'fr', 'de', 'ja', 'ko', 'es', 'it'])
                .withMessage('Language filter is not supported'),
            
            query('sortBy')
                .optional()
                .isIn(['name', 'created_at', 'updated_at', 'word_count', 'popularity'])
                .withMessage('Invalid sort field'),
            
            query('sortOrder')
                .optional()
                .isIn(['asc', 'desc'])
                .withMessage('Sort order must be asc or desc'),
            
            ...this.paginationSchema(),
            this.handleValidationErrors
        ];
    }

    // Share list validation
    static shareListSchema() {
        return [
            param('id')
                .isUUID()
                .withMessage('Invalid list ID format'),
            
            body('recipientEmails')
                .isArray({ min: 1, max: 20 })
                .withMessage('Must specify 1-20 recipient emails'),
            
            body('recipientEmails.*')
                .isEmail()
                .normalizeEmail()
                .withMessage('Invalid email format'),
            
            body('permissions')
                .optional()
                .isIn(['view', 'edit', 'clone'])
                .withMessage('Permissions must be view, edit, or clone'),
            
            body('message')
                .optional()
                .trim()
                .isLength({ max: 500 })
                .withMessage('Message must not exceed 500 characters'),
            
            body('expiresAt')
                .optional()
                .isISO8601()
                .withMessage('Invalid expiration date format')
                .custom((value) => {
                    const expiry = new Date(value);
                    const now = new Date();
                    const maxExpiry = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year
                    
                    if (expiry <= now) {
                        throw new Error('Expiration date must be in the future');
                    }
                    if (expiry > maxExpiry) {
                        throw new Error('Expiration date cannot be more than 1 year from now');
                    }
                    return true;
                }),
            
            this.handleValidationErrors
        ];
    }

    // Import list validation
    static importListSchema() {
        return [
            body('source')
                .isIn(['csv', 'anki', 'quizlet', 'json'])
                .withMessage('Source must be csv, anki, quizlet, or json'),
            
            body('data')
                .notEmpty()
                .withMessage('Import data is required'),
            
            body('name')
                .trim()
                .isLength({ min: 1, max: 200 })
                .withMessage('List name must be between 1-200 characters'),
            
            body('mapping')
                .optional()
                .isObject()
                .withMessage('Mapping must be an object'),
            
            body('options')
                .optional()
                .isObject()
                .withMessage('Options must be an object'),
            
            body('options.skipDuplicates')
                .optional()
                .isBoolean()
                .withMessage('Skip duplicates option must be boolean'),
            
            body('options.autoDetectLanguage')
                .optional()
                .isBoolean()
                .withMessage('Auto detect language option must be boolean'),
            
            this.handleValidationErrors
        ];
    }

    // Clone list validation
    static cloneListSchema() {
        return [
            param('id')
                .isUUID()
                .withMessage('Invalid list ID format'),
            
            body('name')
                .optional()
                .trim()
                .isLength({ min: 1, max: 200 })
                .withMessage('New list name must be between 1-200 characters'),
            
            body('includeProgress')
                .optional()
                .isBoolean()
                .withMessage('Include progress option must be boolean'),
            
            body('privacy')
                .optional()
                .isIn(['private', 'public', 'shared'])
                .withMessage('Privacy must be private, public, or shared'),
            
            this.handleValidationErrors
        ];
    }
}

// models/schemas/vocabulary/VocabularyItemSchema.js
class VocabularyItemSchema extends CommonSchema {
    
    // Add word to list validation
    static addWordSchema() {
        return [
            param('listId')
                .isUUID()
                .withMessage('Invalid list ID format'),
            
            body('word')
                .trim()
                .isLength({ min: 1, max: 100 })
                .withMessage('Word must be between 1-100 characters')
                .matches(/^[a-zA-ZÀ-ÿ\s\-''.]+$/)
                .withMessage('Word contains invalid characters'),
            
            body('meaning')
                .trim()
                .isLength({ min: 1, max: 500 })
                .withMessage('Meaning must be between 1-500 characters'),
            
            body('pronunciation')
                .optional()
                .trim()
                .isLength({ max: 200 })
                .withMessage('Pronunciation must not exceed 200 characters'),
            
            body('example_sentence')
                .optional()
                .trim()
                .isLength({ max: 1000 })
                .withMessage('Example sentence must not exceed 1000 characters'),
            
            body('image_url')
                .optional()
                .isURL()
                .withMessage('Invalid image URL format'),
            
            body('difficulty_level')
                .optional()
                .isIn(['beginner', 'intermediate', 'advanced'])
                .withMessage('Difficulty must be beginner, intermediate, or advanced'),
            
            body('part_of_speech')
                .optional()
                .isIn(['noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction', 'interjection', 'pronoun'])
                .withMessage('Invalid part of speech'),
            
            body('generate_example')
                .optional()
                .isBoolean()
                .withMessage('Generate example option must be boolean'),
            
            body('auto_difficulty')
                .optional()
                .isBoolean()
                .withMessage('Auto difficulty option must be boolean'),
            
            this.handleValidationErrors
        ];
    }

    // Batch add words validation
    static batchAddWordsSchema() {
        return [
            param('listId')
                .isUUID()
                .withMessage('Invalid list ID format'),
            
            body('words')
                .isArray({ min: 1, max: 100 })
                .withMessage('Must provide 1-100 words'),
            
            body('words.*.word')
                .trim()
                .isLength({ min: 1, max: 100 })
                .withMessage('Each word must be between 1-100 characters'),
            
            body('words.*.meaning')
                .trim()
                .isLength({ min: 1, max: 500 })
                .withMessage('Each meaning must be between 1-500 characters'),
            
            body('words.*.pronunciation')
                .optional()
                .trim()
                .isLength({ max: 200 })
                .withMessage('Pronunciation must not exceed 200 characters'),
            
            body('words.*.example_sentence')
                .optional()
                .trim()
                .isLength({ max: 1000 })
                .withMessage('Example sentence must not exceed 1000 characters'),
            
            body('words.*.difficulty_level')
                .optional()
                .isIn(['beginner', 'intermediate', 'advanced'])
                .withMessage('Difficulty must be beginner, intermediate, or advanced'),
            
            body('options.generate_examples')
                .optional()
                .isBoolean()
                .withMessage('Generate examples option must be boolean'),
            
            body('options.auto_difficulty')
                .optional()
                .isBoolean()
                .withMessage('Auto difficulty option must be boolean'),
            
            body('options.skip_duplicates')
                .optional()
                .isBoolean()
                .withMessage('Skip duplicates option must be boolean'),
            
            this.handleValidationErrors
        ];
    }

    // Update word validation
    static updateWordSchema() {
        return [
            param('listId')
                .isUUID()
                .withMessage('Invalid list ID format'),
            
            param('wordId')
                .isUUID()
                .withMessage('Invalid word ID format'),
            
            body('word')
                .optional()
                .trim()
                .isLength({ min: 1, max: 100 })
                .withMessage('Word must be between 1-100 characters'),
            
            body('meaning')
                .optional()
                .trim()
                .isLength({ min: 1, max: 500 })
                .withMessage('Meaning must be between 1-500 characters'),
            
            body('pronunciation')
                .optional()
                .trim()
                .isLength({ max: 200 })
                .withMessage('Pronunciation must not exceed 200 characters'),
            
            body('example_sentence')
                .optional()
                .trim()
                .isLength({ max: 1000 })
                .withMessage('Example sentence must not exceed 1000 characters'),
            
            body('difficulty_level')
                .optional()
                .isIn(['beginner', 'intermediate', 'advanced'])
                .withMessage('Difficulty must be beginner, intermediate, or advanced'),
            
            this.handleValidationErrors
        ];
    }

    // Search vocabulary validation
    static searchSchema() {
        return [
            query('q')
                .trim()
                .isLength({ min: 1, max: 100 })
                .withMessage('Search query must be between 1-100 characters'),
            
            query('listId')
                .optional()
                .isUUID()
                .withMessage('Invalid list ID format'),
            
            query('difficulty')
                .optional()
                .isIn(['beginner', 'intermediate', 'advanced'])
                .withMessage('Difficulty filter must be beginner, intermediate, or advanced'),
            
            query('partOfSpeech')
                .optional()
                .isIn(['noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction', 'interjection', 'pronoun'])
                .withMessage('Invalid part of speech filter'),
            
            query('includeProgress')
                .optional()
                .isBoolean()
                .withMessage('Include progress option must be boolean'),
            
            query('onlyNew')
                .optional()
                .isBoolean()
                .withMessage('Only new option must be boolean'),
            
            query('onlyDue')
                .optional()
                .isBoolean()
                .withMessage('Only due option must be boolean'),
            
            ...this.paginationSchema(),
            this.handleValidationErrors
        ];
    }

    // Generate examples validation
    static generateExamplesSchema() {
        return [
            param('listId')
                .isUUID()
                .withMessage('Invalid list ID format'),
            
            body('wordIds')
                .isArray({ min: 1, max: 50 })
                .withMessage('Must specify 1-50 word IDs'),
            
            body('wordIds.*')
                .isUUID()
                .withMessage('Invalid word ID format'),
            
            body('options.overwriteExisting')
                .optional()
                .isBoolean()
                .withMessage('Overwrite existing option must be boolean'),
            
            body('options.contextHint')
                .optional()
                .trim()
                .isLength({ max: 200 })
                .withMessage('Context hint must not exceed 200 characters'),
            
            this.handleValidationErrors
        ];
    }
}

module.exports = {
    VocabularyListSchema,
    VocabularyItemSchema
};