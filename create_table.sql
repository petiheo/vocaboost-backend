-- supabase/migrations/001_initial_schema.sql

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create custom types
CREATE TYPE user_role AS ENUM ('learner', 'teacher', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE difficulty_level AS ENUM ('beginner', 'intermediate', 'advanced');
CREATE TYPE assignment_type AS ENUM ('vocabulary', 'quiz', 'essay', 'speaking');
CREATE TYPE assignment_status AS ENUM ('assigned', 'in_progress', 'completed', 'overdue');

-- Users table với RLS
CREATE TABLE users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    avatar_url TEXT,
    role user_role DEFAULT 'learner',
    status user_status DEFAULT 'active',
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    deactivated_at TIMESTAMP WITH TIME ZONE,
    deactivation_reason TEXT
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Vocabulary table
CREATE TABLE vocabulary (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    word VARCHAR(100) NOT NULL,
    pronunciation VARCHAR(200),
    part_of_speech VARCHAR(50),
    definition TEXT NOT NULL,
    english_definition TEXT,
    difficulty_level difficulty_level DEFAULT 'beginner',
    frequency_score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT TRUE
);

-- Indexes for vocabulary search and filtering
CREATE INDEX idx_vocabulary_word ON vocabulary USING gin(word gin_trgm_ops);
CREATE INDEX idx_vocabulary_difficulty ON vocabulary(difficulty_level);
CREATE INDEX idx_vocabulary_frequency ON vocabulary(frequency_score DESC);
CREATE INDEX idx_vocabulary_active ON vocabulary(is_active) WHERE is_active = TRUE;

-- Vocabulary examples
CREATE TABLE vocabulary_examples (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    vocabulary_id UUID REFERENCES vocabulary(id) ON DELETE CASCADE,
    english_sentence TEXT NOT NULL,
    vietnamese_translation TEXT NOT NULL,
    audio_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_vocab_examples_vocab_id ON vocabulary_examples(vocabulary_id);

-- User vocabulary tracking với SM-2 algorithm
CREATE TABLE user_vocabulary (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    vocabulary_id UUID REFERENCES vocabulary(id) ON DELETE CASCADE,
    
    -- SM-2 Algorithm fields
    repetitions INTEGER DEFAULT 0,
    easiness DECIMAL(3,2) DEFAULT 2.5,
    interval INTEGER DEFAULT 1,
    next_review_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_review_date TIMESTAMP WITH TIME ZONE,
    
    -- Statistics
    total_reviews INTEGER DEFAULT 0,
    correct_reviews INTEGER DEFAULT 0,
    
    -- Metadata
    first_learned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, vocabulary_id)
);

-- Critical indexes for spaced repetition
-- Fixed: Remove WHERE clause with NOW() as it's not immutable
CREATE INDEX idx_user_vocab_next_review ON user_vocabulary(user_id, next_review_date);
CREATE INDEX idx_user_vocab_user_id ON user_vocabulary(user_id);
CREATE INDEX idx_user_vocab_stats ON user_vocabulary(user_id, repetitions, easiness);

-- Review history for analytics
CREATE TABLE review_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    vocabulary_id UUID REFERENCES vocabulary(id) ON DELETE CASCADE,
    
    -- Review data
    quality INTEGER CHECK (quality >= 0 AND quality <= 5),
    response_time INTEGER, -- milliseconds
    is_correct BOOLEAN,
    
    -- SM-2 context
    previous_interval INTEGER,
    new_interval INTEGER,
    previous_easiness DECIMAL(3,2),
    new_easiness DECIMAL(3,2),
    
    reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Partitioning by month for performance
CREATE INDEX idx_review_history_user_date ON review_history(user_id, reviewed_at DESC);
CREATE INDEX idx_review_history_vocab_date ON review_history(vocabulary_id, reviewed_at DESC);

-- Classrooms
CREATE TABLE classrooms (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    subject VARCHAR(50),
    grade_level INTEGER CHECK (grade_level >= 1 AND grade_level <= 12),
    teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
    class_code VARCHAR(10) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    max_learners INTEGER DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_classrooms_teacher ON classrooms(teacher_id);
CREATE INDEX idx_classrooms_code ON classrooms(class_code);
CREATE INDEX idx_classrooms_active ON classrooms(is_active) WHERE is_active = TRUE;

-- Classroom learners (renamed from classroom_students)
CREATE TABLE classroom_learners (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE,
    learner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'active',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(classroom_id, learner_id)
);

CREATE INDEX idx_classroom_learners_classroom ON classroom_learners(classroom_id, status);
CREATE INDEX idx_classroom_learners_learner ON classroom_learners(learner_id);

-- Assignments
CREATE TABLE assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    assignment_type assignment_type DEFAULT 'vocabulary',
    due_date TIMESTAMP WITH TIME ZONE,
    settings JSONB DEFAULT '{}',
    max_score INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_assignments_classroom ON assignments(classroom_id, is_active);
CREATE INDEX idx_assignments_due_date ON assignments(due_date);
CREATE INDEX idx_assignments_type ON assignments(assignment_type);

-- Assignment vocabulary (many-to-many)
CREATE TABLE assignment_vocabulary (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
    vocabulary_id UUID REFERENCES vocabulary(id) ON DELETE CASCADE,
    
    UNIQUE(assignment_id, vocabulary_id)
);

-- Learner assignments tracking (renamed from student_assignments)
CREATE TABLE learner_assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
    learner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status assignment_status DEFAULT 'assigned',
    score INTEGER,
    max_score INTEGER,
    attempts INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(assignment_id, learner_id)
);

CREATE INDEX idx_learner_assignments_learner ON learner_assignments(learner_id, status);
CREATE INDEX idx_learner_assignments_assignment ON learner_assignments(assignment_id);

-- Classroom invitations
CREATE TABLE classroom_invitations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    invite_code VARCHAR(50) UNIQUE NOT NULL,
    invited_by UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_invitations_code ON classroom_invitations(invite_code);
CREATE INDEX idx_invitations_email ON classroom_invitations(email, status);

-- User settings
CREATE TABLE user_settings (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
    daily_goal INTEGER DEFAULT 10,
    notification_email BOOLEAN DEFAULT TRUE,
    notification_push BOOLEAN DEFAULT TRUE,
    timezone VARCHAR(50) DEFAULT 'Asia/Ho_Chi_Minh',
    language VARCHAR(10) DEFAULT 'vi',
    theme VARCHAR(20) DEFAULT 'light',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User statistics for quick access
CREATE TABLE user_stats (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
    total_vocabulary INTEGER DEFAULT 0,
    mastered_vocabulary INTEGER DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    correct_reviews INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_review_date DATE,
    total_study_time INTEGER DEFAULT 0, -- in minutes
    level INTEGER DEFAULT 1,
    experience_points INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Admin logs
CREATE TABLE admin_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    admin_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_admin_logs_admin ON admin_logs(admin_id, timestamp DESC);
CREATE INDEX idx_admin_logs_action ON admin_logs(action, timestamp DESC);

-- System notifications
CREATE TABLE notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    action_url TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- Content reports table (for USC22)
CREATE TABLE content_reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    reporter_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content_type VARCHAR(50) NOT NULL,
    content_id UUID NOT NULL,
    reason VARCHAR(50) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    resolution VARCHAR(50),
    resolved_by UUID REFERENCES users(id),
    resolution_reason TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_content_reports_status ON content_reports(status, created_at);
CREATE INDEX idx_content_reports_reporter ON content_reports(reporter_id);

-- Teacher requests table (for USC19)
CREATE TABLE teacher_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    documents JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(id),
    review_reason TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_teacher_requests_status ON teacher_requests(status, created_at);
CREATE INDEX idx_teacher_requests_user ON teacher_requests(user_id);

-- Vocabulary lists table
CREATE TABLE vocabulary_lists (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    privacy VARCHAR(20) DEFAULT 'private',
    tags TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_vocabulary_lists_owner ON vocabulary_lists(owner_id);
CREATE INDEX idx_vocabulary_lists_privacy ON vocabulary_lists(privacy) WHERE is_active = TRUE;
CREATE INDEX idx_vocabulary_lists_tags ON vocabulary_lists USING gin(tags);

-- Vocabulary items in lists
CREATE TABLE vocabulary_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    list_id UUID REFERENCES vocabulary_lists(id) ON DELETE CASCADE,
    word VARCHAR(100) NOT NULL,
    meaning TEXT NOT NULL,
    pronunciation VARCHAR(200),
    example_sentence TEXT,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_vocabulary_items_list ON vocabulary_items(list_id);

-- Row Level Security Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for user_vocabulary
CREATE POLICY "Users can manage own vocabulary" ON user_vocabulary
    FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for review_history
CREATE POLICY "Users can view own reviews" ON review_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reviews" ON review_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER set_timestamp_users BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_vocabulary BEFORE UPDATE ON vocabulary
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_user_vocabulary BEFORE UPDATE ON user_vocabulary
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_classrooms BEFORE UPDATE ON classrooms
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_assignments BEFORE UPDATE ON assignments
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_vocabulary_lists BEFORE UPDATE ON vocabulary_lists
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- Function to update user stats
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update user statistics when vocabulary or reviews change
    INSERT INTO user_stats (user_id, total_vocabulary, total_reviews, correct_reviews, updated_at)
    VALUES (
        NEW.user_id,
        (SELECT COUNT(*) FROM user_vocabulary WHERE user_id = NEW.user_id),
        (SELECT COUNT(*) FROM review_history WHERE user_id = NEW.user_id),
        (SELECT COUNT(*) FROM review_history WHERE user_id = NEW.user_id AND is_correct = TRUE),
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        total_vocabulary = EXCLUDED.total_vocabulary,
        total_reviews = EXCLUDED.total_reviews,
        correct_reviews = EXCLUDED.correct_reviews,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply stats triggers
CREATE TRIGGER update_stats_on_vocabulary AFTER INSERT OR UPDATE OR DELETE ON user_vocabulary
    FOR EACH ROW EXECUTE FUNCTION update_user_stats();

CREATE TRIGGER update_stats_on_review AFTER INSERT ON review_history
    FOR EACH ROW EXECUTE FUNCTION update_user_stats();

-- Create stored procedures for common operations

-- Procedure to get review queue for a user
CREATE OR REPLACE FUNCTION get_review_queue(p_user_id UUID, p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
    vocabulary_id UUID,
    word VARCHAR,
    meaning TEXT,
    next_review_date TIMESTAMP WITH TIME ZONE,
    repetitions INTEGER,
    easiness DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        uv.vocabulary_id,
        vi.word,
        vi.meaning,
        uv.next_review_date,
        uv.repetitions,
        uv.easiness
    FROM user_vocabulary uv
    JOIN vocabulary_items vi ON vi.id = uv.vocabulary_id
    WHERE uv.user_id = p_user_id
        AND uv.next_review_date <= CURRENT_TIMESTAMP
    ORDER BY uv.next_review_date ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Procedure to calculate user streak
CREATE OR REPLACE FUNCTION calculate_user_streak(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_streak INTEGER := 0;
    v_last_date DATE;
    v_current_date DATE;
    v_review_date DATE;
BEGIN
    -- Get the most recent review date
    SELECT DATE(reviewed_at) INTO v_last_date
    FROM review_history
    WHERE user_id = p_user_id
    ORDER BY reviewed_at DESC
    LIMIT 1;
    
    -- If no reviews, return 0
    IF v_last_date IS NULL THEN
        RETURN 0;
    END IF;
    
    -- If last review was not today or yesterday, streak is broken
    IF v_last_date < CURRENT_DATE - INTERVAL '1 day' THEN
        RETURN 0;
    END IF;
    
    -- Count consecutive days
    v_current_date := v_last_date;
    
    FOR v_review_date IN
        SELECT DISTINCT DATE(reviewed_at) AS review_date
        FROM review_history
        WHERE user_id = p_user_id
        ORDER BY review_date DESC
    LOOP
        IF v_review_date = v_current_date OR 
           v_review_date = v_current_date - INTERVAL '1 day' THEN
            v_streak := v_streak + 1;
            v_current_date := v_review_date;
        ELSE
            EXIT;
        END IF;
    END LOOP;
    
    RETURN v_streak;
END;
$$ LANGUAGE plpgsql;

-- Add password reset tokens table
CREATE TABLE password_resets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_password_resets_token ON password_resets(token) WHERE used = FALSE;
CREATE INDEX idx_password_resets_user ON password_resets(user_id);

-- Add sessions table for OAuth
CREATE TABLE sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);