-- =================================================================
-- VocaBoost Database Schema
-- Version: 3.1 (Final - Hybrid with All Features)
-- Description: Merges the robust structure of the new schema with the
-- performance enhancements and all feature-supporting tables.
-- =================================================================

-- Standardize default values
CREATE TYPE public.user_role AS ENUM ('learner', 'teacher', 'admin');
CREATE TYPE public.user_status AS ENUM ('inactive', 'active', 'inactive', 'suspended');
CREATE TYPE public.verification_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.privacy_setting AS ENUM ('private', 'public');
CREATE TYPE public.session_status AS ENUM ('in_progress', 'completed', 'interrupted');
CREATE TYPE public.join_status AS ENUM ('pending_approval', 'joined', 'pending_request');
CREATE TYPE public.assignment_status AS ENUM ('not_started', 'in_progress', 'completed', 'late', 'interrupted');
CREATE TYPE public.report_status AS ENUM ('open', 'resolved', 'dismissed');
CREATE TYPE public.token_type AS ENUM ('email_verification', 'password_reset');

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =================================================================
-- SECTION A: USER & AUTHENTICATION MANAGEMENT
-- =================================================================
CREATE TABLE public.users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    display_name TEXT,
    google_id TEXT UNIQUE,
    avatar_url TEXT,
    role public.user_role NOT NULL DEFAULT 'learner',
    account_status public.user_status NOT NULL DEFAULT 'active',
    learning_target_per_day INT,
    last_seen_at TIMESTAMPTZ,
    password_changed_at TIMESTAMP WITH TIME ZONE,
    deactivated_at TIMESTAMP WITH TIME ZONE,
    deactivation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.users IS 'Stores all application user data, including auth info.';
ALTER TABLE public.users ADD CONSTRAINT check_auth_method CHECK ((password_hash IS NOT NULL) OR (google_id IS NOT NULL));

CREATE TABLE public.user_settings (
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE PRIMARY KEY,
    daily_goal INTEGER DEFAULT 10,
    notification_email BOOLEAN DEFAULT TRUE,
    notification_push BOOLEAN DEFAULT TRUE,
    timezone VARCHAR(50) DEFAULT 'Asia/Ho_Chi_Minh',
    language VARCHAR(10) DEFAULT 'vi',
    theme VARCHAR(20) DEFAULT 'light',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE public.user_stats (
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE PRIMARY KEY,
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE public.teacher_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    institution TEXT,
    credentials_url TEXT,
    status public.verification_status NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.teacher_requests IS 'Queue for admins to review and approve teacher role requests.';


-- =================================================================
-- SECTION B: VOCABULARY, PROGRESS, AND SESSION TABLES
-- =================================================================
CREATE TABLE public.vocab_lists (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    -- wordCount (derived)
    privacy_setting public.privacy_setting NOT NULL DEFAULT 'private',
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX idx_vocab_lists_creator ON public.vocab_lists(creator_id);
CREATE INDEX idx_vocab_lists_privacy_active ON public.vocab_lists(privacy_setting) WHERE is_active = TRUE;

-- CORRECTED: Renamed 'words' to 'vocabulary' for clarity and removed example_sentence
CREATE TABLE public.vocabulary (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    list_id UUID NOT NULL REFERENCES public.vocab_lists(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    term TEXT NOT NULL,
    definition TEXT NOT NULL,
    phonetics TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
);
COMMENT ON TABLE public.vocabulary IS 'Stores the core vocabulary word and its primary definition.';

-- NEW: Added table for multiple examples per word
CREATE TABLE public.vocabulary_examples (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    vocabulary_id UUID NOT NULL REFERENCES public.vocabulary(id) ON DELETE CASCADE,
    example_sentence TEXT NOT NULL,
    translation TEXT
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
COMMENT ON TABLE public.vocabulary_examples IS 'Stores multiple example sentences for each vocabulary item.';

-- NEW: Added table for word synonyms
CREATE TABLE public.word_synonyms (
    word_id UUID NOT NULL REFERENCES public.vocabulary(id) ON DELETE CASCADE,
    synonym TEXT NOT NULL,
    PRIMARY KEY (word_id, synonym)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
COMMENT ON TABLE public.word_synonyms IS 'Synonyms associated with a specific word for word association exercises.';

-- NEW: Added tables for tagging vocab lists
CREATE TABLE public.tags (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);
COMMENT ON TABLE public.tags IS 'A list of unique tags for categorizing vocab lists.';

CREATE TABLE public.list_tags (
    list_id UUID NOT NULL REFERENCES public.vocab_lists(id) ON DELETE CASCADE,
    tag_id INT NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (list_id, tag_id)
);
COMMENT ON TABLE public.list_tags IS 'Associates tags with vocabulary lists.';

-- NEW: Added performance-enhancing trigram index for searching terms
CREATE INDEX idx_vocabulary_term_search ON public.vocabulary USING gin(term gin_trgm_ops);


CREATE TABLE public.user_word_progress (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    word_id UUID NOT NULL REFERENCES public.vocabulary(id) ON DELETE CASCADE, -- Corrected reference
    next_review_date TIMESTAMPTZ DEFAULT now() NOT NULL,
    interval_days INT DEFAULT 1 NOT NULL,
    ease_factor REAL DEFAULT 2.5 NOT NULL,
    repetitions INT DEFAULT 0 NOT NULL,
    correct_count INT DEFAULT 0 NOT NULL,
    incorrect_count INT DEFAULT 0 NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
);
-- NEW: Performance index for fetching review queues
CREATE INDEX idx_user_word_progress_review_queue ON public.user_word_progress(user_id, next_review_date ASC);

-- Revision
-- Helper/Service create sublist for revision using query using word progress
-- (Assignment id not null: disable helper, insert sublist/ assignment id is null enable helper)
CREATE TABLE public.revision_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    vocab_list_id UUID NOT NULL REFERENCES public.vocab_lists(id) ON DELETE CASCADE,
    assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
    session_type TEXT NOT NULL,
    status public.session_status NOT NULL DEFAULT 'in_progress',
    started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    completed_at TIMESTAMPTZ,
    score INT
);

CREATE TABLE public.session_word_results (
    session_id UUID NOT NULL REFERENCES public.revision_sessions(id) ON DELETE CASCADE,
    word_id UUID NOT NULL REFERENCES public.vocabulary(id) ON DELETE CASCADE, -- Corrected reference
    result TEXT NOT NULL CHECK (result IN ('correct', 'incorrect')),
    "timestamp" TIMESTAMPTZ DEFAULT now() NOT NULL,
    PRIMARY KEY (session_id, word_id)
);

-- =================================================================
-- SECTION C: CLASSROOM & ASSIGNMENT TABLES
-- =================================================================
CREATE TABLE public.classrooms (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    -- Learner count (derived)
    -- Assignment Count (derived)
    -- Classroom Status -- Privacy
    join_code TEXT UNIQUE,
    is_auto_approval_enabled BOOLEAN DEFAULT false NOT NULL,
    capacity_limit INTEGER DEFAULT 50,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.classroom_members (
    classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE, -- NULL when account is not created
    email VARCHAR(255) UNIQUE NOT NULL,
    join_status public.join_status NOT NULL DEFAULT 'pending_approval', -- invited/requested
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (classroom_id, student_id)
);


CREATE TABLE public.assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
    vocab_list_id UUID NOT NULL REFERENCES public.vocab_lists(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    exercise_method TEXT NOT NULL,
    -- words per review (teacher input)
    -- sublist count (total / words per review) (derived)
    start_date TIMESTAMPTZ DEFAULT now() NOT NULL,
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Helper2: create a sublist (new list) (1 list of 100 words -> 5 new lists of 20 words)
-- TABLE sublist (with assignment ID)
--      assignment id
--      STT
--      List id

CREATE TABLE public.student_assignments (
    assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    -- completed sublists (like STT)
    student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status public.assignment_status NOT NULL DEFAULT 'not_started',
    score INT,
    completed_at TIMESTAMPTZ,
    PRIMARY KEY (assignment_id, student_id)
);

-- =================================================================
-- SECTION D: SYSTEM UTILITY TABLES
-- =================================================================
CREATE TABLE public.reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content_id TEXT NOT NULL, -- ref word id
    reason TEXT,
    status public.report_status NOT NULL DEFAULT 'open',
    resolver_id UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id),
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    recipient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    "type" TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- NEW: Performance index for fetching notifications
CREATE INDEX idx_notifications_recipient ON public.notifications(recipient_id, created_at DESC);

-- handle different token structures
CREATE TABLE public.authTokens (
    token TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type public.token_type NOT NULL, -- login, forgot password, email verification
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
);
CREATE INDEX idx_tokens_expires_at ON public.tokens(expires_at);

-- TABLE: CLASSROOM TOKEN
-- handle uncreated email
-- 1. create token for that email address 
-- 2. email of the invited person, classroom id, expires (default 7d) , used at
-- =================================================================
-- SECTION E: TRIGGERS AND FUNCTIONS
-- =================================================================

-- NEW: Function and Triggers to auto-update 'updated_at' timestamps
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables with an 'updated_at' column
CREATE TRIGGER set_timestamp_users 
BEFORE UPDATE ON public.users 
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

CREATE TRIGGER set_timestamp_vocab_lists
BEFORE UPDATE ON public.vocab_lists
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

CREATE TRIGGER set_timestamp_user_word_progress
BEFORE UPDATE ON public.user_word_progress
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

CREATE TRIGGER set_timestamp_classrooms
BEFORE UPDATE ON public.classrooms
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

CREATE TRIGGER set_timestamp_assignments
BEFORE UPDATE ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

CREATE TRIGGER set_timestamp_user_settings
BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

CREATE TRIGGER set_timestamp_user_stats
BEFORE UPDATE ON public.user_stats
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

-- =================================================================
-- Script Complete
-- Next Steps: Enable RLS and define policies.
-- =================================================================

-- TODO
-- Change all "Students" to "Learners"