-- =================================================================
-- VocaBoost Database Schema
-- Version: 2.0 (Modified to avoid Supabase user permission issues)
-- Fully safe to run on Supabase without RLS blocking connections
-- =================================================================

-- Step 1: Enable Necessary Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Step 2: Create Custom ENUM Types
CREATE TYPE public.user_role AS ENUM ('learner', 'teacher', 'admin');
CREATE TYPE public.user_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE public.assignment_type AS ENUM ('vocabulary', 'quiz', 'essay', 'speaking');
CREATE TYPE public.assignment_status AS ENUM ('assigned', 'in_progress', 'completed', 'overdue');
CREATE TYPE public.privacy_setting AS ENUM ('private', 'public', 'classroom_only');
CREATE TYPE public.report_status AS ENUM ('pending', 'resolved', 'dismissed');
CREATE TYPE public.token_type AS ENUM ('email_verification', 'password_reset');
CREATE TYPE public.invite_status AS ENUM ('pending', 'accepted', 'expired');
CREATE TYPE public.verification_status AS ENUM ('pending', 'approved', 'rejected');

-- =================================================================
-- SECTION A: USER & AUTHENTICATION MANAGEMENT
-- =================================================================

CREATE TABLE public.users (
    id UUID uuid_generate_v4() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name VARCHAR(100),
    avatar_url TEXT,
    role public.user_role DEFAULT 'learner' NOT NULL,
    status public.user_status DEFAULT 'active' NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE NOT NULL,
    google_id VARCHAR(255) UNIQUE,
    password_changed_at TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE,
    deactivated_at TIMESTAMP WITH TIME ZONE,
    deactivation_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
COMMENT ON TABLE public.users IS 'Stores application-specific user data, extending Supabase auth.';

ALTER TABLE public.users 
ADD CONSTRAINT check_auth_method 
CHECK ((password_hash IS NOT NULL) OR (google_id IS NOT NULL));

CREATE TABLE public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    daily_goal INTEGER DEFAULT 10,
    notification_email BOOLEAN DEFAULT TRUE NOT NULL,
    notification_push BOOLEAN DEFAULT TRUE NOT NULL,
    timezone VARCHAR(50) DEFAULT 'Asia/Ho_Chi_Minh',
    language VARCHAR(10) DEFAULT 'vi',
    theme VARCHAR(20) DEFAULT 'light',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
COMMENT ON TABLE public.user_settings IS 'Stores user-specific preferences and settings.';

-- =================================================================
-- SECTION B: VOCABULARY CONTENT MANAGEMENT
-- =================================================================

CREATE TABLE public.tags (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE public.vocab_lists (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    privacy public.privacy_setting DEFAULT 'private' NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE public.list_tags (
    list_id UUID NOT NULL REFERENCES public.vocab_lists(id) ON DELETE CASCADE,
    tag_id INT NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (list_id, tag_id)
);

CREATE TABLE public.words (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    list_id UUID NOT NULL REFERENCES public.vocab_lists(id) ON DELETE CASCADE,
    term TEXT NOT NULL,
    definition TEXT NOT NULL,
    phonetics TEXT,
    example_sentence TEXT,
    image_url TEXT,
    audio_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE public.word_synonyms (
    word_id UUID NOT NULL REFERENCES public.words(id) ON DELETE CASCADE,
    synonym TEXT NOT NULL,
    PRIMARY KEY (word_id, synonym)
);

-- =================================================================
-- SECTION C: LEARNING & PROGRESS TRACKING
-- =================================================================

CREATE TABLE public.user_vocabulary (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    word_id UUID NOT NULL REFERENCES public.words(id) ON DELETE CASCADE,
    repetitions INTEGER DEFAULT 0 NOT NULL,
    easiness DECIMAL(3,2) DEFAULT 2.5 NOT NULL,
    interval INTEGER DEFAULT 1 NOT NULL,
    next_review_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    last_review_date TIMESTAMP WITH TIME ZONE,
    total_reviews INTEGER DEFAULT 0 NOT NULL,
    correct_reviews INTEGER DEFAULT 0 NOT NULL,
    first_learned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, word_id)
);

CREATE TABLE public.review_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    word_id UUID NOT NULL REFERENCES public.words(id) ON DELETE CASCADE,
    quality INTEGER CHECK (quality >= 0 AND quality <= 5),
    response_time INTEGER,
    is_correct BOOLEAN,
    previous_interval INTEGER,
    new_interval INTEGER,
    previous_easiness DECIMAL(3,2),
    new_easiness DECIMAL(3,2),
    reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE public.user_stats (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    total_vocabulary INTEGER DEFAULT 0 NOT NULL,
    mastered_vocabulary INTEGER DEFAULT 0 NOT NULL,
    total_reviews INTEGER DEFAULT 0 NOT NULL,
    correct_reviews INTEGER DEFAULT 0 NOT NULL,
    current_streak INTEGER DEFAULT 0 NOT NULL,
    longest_streak INTEGER DEFAULT 0 NOT NULL,
    last_review_date DATE,
    total_study_time INTEGER DEFAULT 0 NOT NULL,
    level INTEGER DEFAULT 1 NOT NULL,
    experience_points INTEGER DEFAULT 0 NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- =================================================================
-- SECTION D: CLASSROOM & ASSIGNMENT MANAGEMENT
-- =================================================================

CREATE TABLE public.classrooms (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    subject VARCHAR(50),
    grade_level INTEGER CHECK (grade_level >= 1 AND grade_level <= 12),
    class_code VARCHAR(10) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    max_learners INTEGER DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE public.classroom_learners (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
    learner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'active' NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    left_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(classroom_id, learner_id)
);

CREATE TABLE public.assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
    vocab_list_id UUID REFERENCES public.vocab_lists(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    assignment_type public.assignment_type DEFAULT 'vocabulary' NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    settings JSONB DEFAULT '{}'::jsonb,
    max_score INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE public.learner_assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    learner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status public.assignment_status DEFAULT 'assigned' NOT NULL,
    score INTEGER,
    max_score INTEGER,
    attempts INTEGER DEFAULT 0 NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE(assignment_id, learner_id)
);

-- =================================================================
-- SECTION E: SYSTEM UTILITIES & MODERATION
-- =================================================================

CREATE TABLE public.tokens (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    type public.token_type NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info' NOT NULL,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    action_url TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE public.content_reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content_type VARCHAR(50) NOT NULL,
    content_id UUID NOT NULL,
    reason VARCHAR(50) NOT NULL,
    description TEXT,
    status public.report_status DEFAULT 'pending' NOT NULL,
    resolution VARCHAR(50),
    resolved_by UUID REFERENCES public.users(id),
    resolution_reason TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE public.teacher_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    documents JSONB,
    status public.verification_status DEFAULT 'pending' NOT NULL,
    reviewed_by UUID REFERENCES public.users(id),
    review_reason TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE public.admin_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    admin_id UUID NOT NULL REFERENCES public.users(id),
    action VARCHAR(50) NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- =================================================================
-- SECTION F: INDEXES, TRIGGERS
-- =================================================================

CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_users BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_vocab_lists BEFORE UPDATE ON public.vocab_lists FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_user_vocabulary BEFORE UPDATE ON public.user_vocabulary FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_classrooms BEFORE UPDATE ON public.classrooms FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_assignments BEFORE UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_user_settings BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_user_stats BEFORE UPDATE ON public.user_stats FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

-- =================================================================
-- Script Complete
-- Safe for Supabase development without RLS permission issues.
-- Add RLS + policies when ready for production.
-- =================================================================