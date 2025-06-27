// models/index.js - MODEL LAYER MAIN ENTRY POINT

// ============================================================================
// BUSINESS LOGIC LAYER - Core Services
// ============================================================================
const AuthService = require('./business-logic/core/AuthService');
const UserService = require('./business-logic/core/UserService');
const VocabularyService = require('./business-logic/core/VocabularyService');
const ReviewService = require('./business-logic/core/ReviewService');
const ClassroomService = require('./business-logic/core/ClassroomService');
const AdminService = require('./business-logic/core/AdminService');

// ============================================================================
// BUSINESS LOGIC LAYER - Integration Services
// ============================================================================
const AIService = require('./business-logic/integrations/AIService');
const EmailService = require('./business-logic/integrations/EmailService');
const OAuthService = require('./business-logic/integrations/OAuthService');
const CacheService = require('./business-logic/integrations/CacheService');

// ============================================================================
// BUSINESS LOGIC LAYER - Algorithm Services
// ============================================================================
const SpacedRepetitionService = require('./business-logic/algorithms/SpacedRepetitionService');
const RecommendationService = require('./business-logic/algorithms/RecommendationService');
const AnalyticsService = require('./business-logic/algorithms/AnalyticsService');

// ============================================================================
// SCHEMA LAYER - Validation Schemas
// ============================================================================
const AuthSchema = require('./schemas/auth/AuthSchema');
const UserProfileSchema = require('./schemas/user/UserProfileSchema');
const UserSettingsSchema = require('./schemas/user/UserSettingsSchema');
const VocabularyListSchema = require('./schemas/vocabulary/VocabularyListSchema');
const VocabularyItemSchema = require('./schemas/vocabulary/VocabularyItemSchema');
const ReviewSessionSchema = require('./schemas/review/ReviewSessionSchema');
const ClassroomSchema = require('./schemas/classroom/ClassroomSchema');
const AssignmentSchema = require('./schemas/classroom/AssignmentSchema');

// ============================================================================
// REPOSITORY LAYER - Data Access
// ============================================================================
const UserRepository = require('./repositories/auth/UserRepository');
const TokenRepository = require('./repositories/auth/TokenRepository');
const SessionRepository = require('./repositories/auth/SessionRepository');
const VocabularyListRepository = require('./repositories/vocabulary/VocabularyListRepository');
const VocabularyItemRepository = require('./repositories/vocabulary/VocabularyItemRepository');
const LearningProgressRepository = require('./repositories/learning/LearningProgressRepository');
const ReviewHistoryRepository = require('./repositories/learning/ReviewHistoryRepository');
const ClassroomRepository = require('./repositories/classroom/ClassroomRepository');
const AssignmentRepository = require('./repositories/classroom/AssignmentRepository');

// ============================================================================
// MODEL LAYER EXPORT - Organized by Layer
// ============================================================================
module.exports = {
    // Business Logic Layer
    services: {
        // Core business services
        auth: new AuthService(),
        user: new UserService(),
        vocabulary: new VocabularyService(),
        review: new ReviewService(),
        classroom: new ClassroomService(),
        admin: new AdminService(),
        
        // Integration services
        ai: new AIService(),
        email: new EmailService(),
        oauth: new OAuthService(),
        cache: new CacheService(),
        
        // Algorithm services
        spacedRepetition: new SpacedRepetitionService(),
        recommendation: new RecommendationService(),
        analytics: new AnalyticsService()
    },
    
    // Schema Layer
    schemas: {
        auth: AuthSchema,
        user: {
            profile: UserProfileSchema,
            settings: UserSettingsSchema
        },
        vocabulary: {
            list: VocabularyListSchema,
            item: VocabularyItemSchema
        },
        review: {
            session: ReviewSessionSchema
        },
        classroom: {
            classroom: ClassroomSchema,
            assignment: AssignmentSchema
        }
    },
    
    // Repository Layer
    repositories: {
        // Auth repositories
        user: new UserRepository(),
        token: new TokenRepository(),
        session: new SessionRepository(),
        
        // Vocabulary repositories
        vocabularyList: new VocabularyListRepository(),
        vocabularyItem: new VocabularyItemRepository(),
        
        // Learning repositories
        learningProgress: new LearningProgressRepository(),
        reviewHistory: new ReviewHistoryRepository(),
        
        // Classroom repositories
        classroom: new ClassroomRepository(),
        assignment: new AssignmentRepository()
    }
};

// ============================================================================
// LAYER INTERACTION GUIDELINES
// ============================================================================

/*
PROPER LAYER INTERACTION:

✅ ALLOWED:
- Controller → Business Logic Service
- Business Logic Service → Repository
- Business Logic Service → Integration Service
- Business Logic Service → Algorithm Service
- Routes → Schema Validation
- Schema → Common Validation Utils

❌ NOT ALLOWED:
- Controller → Repository (skip business logic)
- Repository → Business Logic Service (circular dependency)
- Schema → Business Logic Service (validation should be pure)
- Routes → Repository (bypass all business logic)

BEST PRACTICES:

1. Controllers should ONLY:
   - Handle HTTP requests/responses
   - Call appropriate Service methods
   - Handle errors appropriately

2. Business Logic Services should:
   - Contain all business rules
   - Orchestrate multiple repositories
   - Handle complex workflows
   - Call external services when needed

3. Repositories should ONLY:
   - Handle data persistence
   - Provide CRUD operations
   - Execute database queries
   - No business logic

4. Schemas should ONLY:
   - Define validation rules
   - Handle input sanitization
   - Be pure functions (no side effects)

5. Integration Services should:
   - Handle external API calls
   - Manage third-party integrations
   - Provide retry logic and error handling
*/