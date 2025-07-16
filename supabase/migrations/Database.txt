-- ================================================================
-- VocaBoost Database Schema v3.3 (Clean Init, Supabase Safe)
-- Fully ready for CI/CD, local initialization, and reproducibility.
-- ================================================================

-- === EXTENSIONS ===
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- === ENUM TYPES WITH SAFE CREATION ===
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('learner', 'teacher', 'admin');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE public.user_status AS ENUM ('pending_verification', 'active', 'inactive', 'suspended');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status') THEN
        CREATE TYPE public.verification_status AS ENUM ('pending', 'approved', 'rejected');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'privacy_setting') THEN
        CREATE TYPE public.privacy_setting AS ENUM ('private', 'public');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_status') THEN
        CREATE TYPE public.session_status AS ENUM ('in_progress', 'completed', 'interrupted');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'join_status') THEN
        CREATE TYPE public.join_status AS ENUM ('pending_request', 'pending_invite', 'joined', 'rejected');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_status') THEN
        CREATE TYPE public.assignment_status AS ENUM ('not_started', 'in_progress', 'completed', 'late', 'interrupted');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
        CREATE TYPE public.report_status AS ENUM ('open', 'resolved', 'dismissed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'token_type') THEN
        CREATE TYPE public.token_type AS ENUM ('email_verification', 'password_reset');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'classroom_status') THEN
        CREATE TYPE public.classroom_status AS ENUM ('private', 'public', 'deleted');
    END IF;
END $$;

-- === FUNCTION FOR TRIGGERS ===
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- TABLE CREATION (NO FOREIGN KEYS YET)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    display_name TEXT,
    google_id TEXT UNIQUE,
    avatar_url TEXT,
    role public.user_role NOT NULL DEFAULT 'learner',
    account_status public.user_status NOT NULL DEFAULT 'active',
    email_verified BOOLEAN DEFAULT FALSE,
    password_changed_at TIMESTAMPTZ,
    deactivated_at TIMESTAMPTZ, -- split off
    deactivation_reason TEXT, -- split off + DACTIVATED BY
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_deactivation (
    user_id UUID DEFAULT uuid_generate_v4(),
    deactivated_by UUID NOT NULL,
    deactivated_at TIMESTAMPTZ, -- split off
    deactivation_reason TEXT, -- split off + DACTIVATED BY

    PRIMARY KEY (user_id, deactivated_by)
);

CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY,
    daily_goal INTEGER DEFAULT 10, 
    timezone VARCHAR(50) DEFAULT 'Asia/Ho_Chi_Minh',
    language VARCHAR(10) DEFAULT 'vi',
    theme VARCHAR(20) DEFAULT 'light',
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_stats (
    user_id UUID PRIMARY KEY,
    total_vocabulary INTEGER DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    correct_reviews INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_review_date DATE,
    total_study_time INTEGER DEFAULT 0, 
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.teacher_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL,
    institution TEXT,
    credentials_url TEXT,
    status public.verification_status NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    reviewed_by UUID,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Vocab Module
CREATE TABLE IF NOT EXISTS public.vocab_lists (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    creator_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    wordCount INT DEFAULT 0,
    privacy_setting public.privacy_setting NOT NULL DEFAULT 'private',
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.vocabulary (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY, -- weak entity set (idx)
    list_id UUID NOT NULL,
    created_by UUID,
    term TEXT NOT NULL,
    definition TEXT NOT NULL,
    phonetics TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.vocabulary_examples (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    vocabulary_id UUID NOT NULL,
    example_sentence TEXT NOT NULL,
    translation TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.word_synonyms (
    word_id UUID NOT NULL,
    synonym TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    PRIMARY KEY (word_id, synonym)
);

CREATE TABLE IF NOT EXISTS public.tags (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.list_tags (
    list_id UUID NOT NULL,
    tag_id INT NOT NULL,
    PRIMARY KEY (list_id, tag_id)
);

-- Revision
CREATE TABLE IF NOT EXISTS public.user_word_progress (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL,
    word_id UUID NOT NULL,
    next_review_date TIMESTAMPTZ DEFAULT now() NOT NULL,
    interval_days INT DEFAULT 1 NOT NULL,
    ease_factor REAL DEFAULT 2.5 NOT NULL,
    repetitions INT DEFAULT 0 NOT NULL,
    correct_count INT DEFAULT 0 NOT NULL,
    incorrect_count INT DEFAULT 0 NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (user_id, word_id)
);

CREATE TABLE IF NOT EXISTS public.revision_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL,
    vocab_list_id UUID NOT NULL,
    assignment_id UUID,
    session_type TEXT NOT NULL,
    status public.session_status NOT NULL DEFAULT 'in_progress',
    started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    completed_at TIMESTAMPTZ,
    score INT
);

CREATE TABLE IF NOT EXISTS public.session_word_results (
    session_id UUID NOT NULL,
    word_id UUID NOT NULL,
    result TEXT NOT NULL CHECK (result IN ('correct', 'incorrect')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    PRIMARY KEY (session_id, word_id)
);


-- Classroom Module
CREATE TABLE IF NOT EXISTS public.classrooms (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    teacher_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    join_code TEXT UNIQUE,
    learnerCount INT DEFAULT 0,
    assignmentCount INT DEFAULT 0,
    classroom_status public.classroom_status NOT NULL DEFAULT 'private',
    is_auto_approval_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    capacity_limit INTEGER DEFAULT 50,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.classroom_members (
    classroom_id UUID NOT NULL,
    learner_id UUID,
    email TEXT NOT NULL,
    join_status public.join_status NOT NULL DEFAULT 'pending_invite',
    joined_at TIMESTAMPTZ,
    left_at TIMESTAMPTZ,
    PRIMARY KEY (classroom_id, learner_id),
    UNIQUE (classroom_id, email)
);

CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    classroom_id UUID NOT NULL,
    vocab_list_id UUID NOT NULL,
    teacher_id UUID NOT NULL,
    exercise_method TEXT NOT NULL,
    words_per_review INT,
    sublistCount INT,
    start_date TIMESTAMPTZ DEFAULT now() NOT NULL,
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.assignment_sublists (
    assignment_id UUID NOT NULL,
    sublist_index INT NOT NULL,
    vocab_list_id UUID NOT NULL, -- (cloned vocab list)
    PRIMARY KEY (assignment_id, sublist_index)
);

CREATE TABLE IF NOT EXISTS public.learner_assignments (
    assignment_id UUID NOT NULL,
    learner_id UUID NOT NULL,
    completed_sublist_index INT DEFAULT 0,
    status public.assignment_status NOT NULL DEFAULT 'not_started',
    score INT,
    completed_at TIMESTAMPTZ,
    PRIMARY KEY (assignment_id, learner_id)
);

CREATE TABLE IF NOT EXISTS public.reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    reporter_id UUID NOT NULL,
    word_id UUID NOT NULL,
    reason TEXT,
    status public.report_status NOT NULL DEFAULT 'open',
    resolver_id UUID,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID,
    action TEXT NOT NULL,
    target_type TEXT, -- crud, Actions
    target_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    recipient_id UUID NOT NULL,
    notification_type TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.auth_tokens (
    token TEXT PRIMARY KEY,
    user_id UUID NOT NULL,
    token_type public.token_type NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.classroom_invitations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    classroom_id UUID NOT NULL,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    status public.join_status NOT NULL DEFAULT 'pending_invite',
    UNIQUE (classroom_id, email)
);
-- ================================================================
-- FOREIGN KEY CONSTRAINTS (ADDED AFTER TABLE CREATION)
-- ================================================================

ALTER TABLE public.user_settings ADD CONSTRAINT fk_user_settings_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_stats ADD CONSTRAINT fk_user_stats_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.teacher_requests ADD CONSTRAINT fk_teacher_requests_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.teacher_requests ADD CONSTRAINT fk_teacher_requests_reviewer FOREIGN KEY (reviewed_by) REFERENCES public.users(id);
ALTER TABLE public.vocab_lists ADD CONSTRAINT fk_vocab_lists_creator FOREIGN KEY (creator_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.vocabulary ADD CONSTRAINT fk_vocabulary_list FOREIGN KEY (list_id) REFERENCES public.vocab_lists(id) ON DELETE CASCADE;
ALTER TABLE public.vocabulary ADD CONSTRAINT fk_vocabulary_creator FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE public.vocabulary_examples ADD CONSTRAINT fk_vocab_examples_vocabulary FOREIGN KEY (vocabulary_id) REFERENCES public.vocabulary(id) ON DELETE CASCADE;
ALTER TABLE public.word_synonyms ADD CONSTRAINT fk_word_synonyms_word FOREIGN KEY (word_id) REFERENCES public.vocabulary(id) ON DELETE CASCADE;
ALTER TABLE public.list_tags ADD CONSTRAINT fk_list_tags_list FOREIGN KEY (list_id) REFERENCES public.vocab_lists(id) ON DELETE CASCADE;
ALTER TABLE public.list_tags ADD CONSTRAINT fk_list_tags_tag FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;
ALTER TABLE public.user_word_progress ADD CONSTRAINT fk_user_word_progress_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_word_progress ADD CONSTRAINT fk_user_word_progress_word FOREIGN KEY (word_id) REFERENCES public.vocabulary(id) ON DELETE CASCADE;
ALTER TABLE public.revision_sessions ADD CONSTRAINT fk_revision_sessions_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.revision_sessions ADD CONSTRAINT fk_revision_sessions_list FOREIGN KEY (vocab_list_id) REFERENCES public.vocab_lists(id) ON DELETE CASCADE;
ALTER TABLE public.revision_sessions ADD CONSTRAINT fk_revision_sessions_assignment FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;
ALTER TABLE public.session_word_results ADD CONSTRAINT fk_session_word_results_session FOREIGN KEY (session_id) REFERENCES public.revision_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.session_word_results ADD CONSTRAINT fk_session_word_results_word FOREIGN KEY (word_id) REFERENCES public.vocabulary(id) ON DELETE CASCADE;
ALTER TABLE public.classrooms ADD CONSTRAINT fk_classrooms_teacher FOREIGN KEY (teacher_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.classroom_members ADD CONSTRAINT fk_classroom_members_classroom FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE CASCADE;
ALTER TABLE public.classroom_members ADD CONSTRAINT fk_classroom_members_learner FOREIGN KEY (learner_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.assignments ADD CONSTRAINT fk_assignments_classroom FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE CASCADE;
ALTER TABLE public.assignments ADD CONSTRAINT fk_assignments_vocab_list FOREIGN KEY (vocab_list_id) REFERENCES public.vocab_lists(id) ON DELETE CASCADE;
ALTER TABLE public.assignments ADD CONSTRAINT fk_assignments_teacher FOREIGN KEY (teacher_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.assignment_sublists ADD CONSTRAINT fk_assignment_sublists_assignment FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;
ALTER TABLE public.assignment_sublists ADD CONSTRAINT fk_assignment_sublists_vocab_list FOREIGN KEY (vocab_list_id) REFERENCES public.vocab_lists(id) ON DELETE CASCADE;
ALTER TABLE public.learner_assignments ADD CONSTRAINT fk_learner_assignments_assignment FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;
ALTER TABLE public.learner_assignments ADD CONSTRAINT fk_learner_assignments_learner FOREIGN KEY (learner_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.reports ADD CONSTRAINT fk_reports_reporter FOREIGN KEY (reporter_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.reports ADD CONSTRAINT fk_reports_word FOREIGN KEY (word_id) REFERENCES public.vocabulary(id) ON DELETE CASCADE;
ALTER TABLE public.audit_logs ADD CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE public.notifications ADD CONSTRAINT fk_notifications_recipient FOREIGN KEY (recipient_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.auth_tokens ADD CONSTRAINT fk_auth_tokens_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.classroom_invitations ADD CONSTRAINT fk_classroom_invitations_classroom FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE CASCADE;
ALTER TABLE public.user_deactivation
    ADD CONSTRAINT fk_user_deactivation_user
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_user_deactivation_deactivated_by
        FOREIGN KEY (deactivated_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- ================================================================
-- INDEXES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_vocab_lists_creator ON public.vocab_lists(creator_id);
CREATE INDEX IF NOT EXISTS idx_vocab_lists_privacy_active ON public.vocab_lists(privacy_setting) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_vocabulary_term_search ON public.vocabulary USING gin(term gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_user_word_progress_review_queue ON public.user_word_progress(user_id, next_review_date ASC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires_at ON public.auth_tokens(expires_at);

-- ================================================================
-- TRIGGERS
-- ================================================================

CREATE TRIGGER set_timestamp_users BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_vocab_lists BEFORE UPDATE ON public.vocab_lists FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_vocabulary BEFORE UPDATE ON public.vocabulary FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_user_word_progress BEFORE UPDATE ON public.user_word_progress FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_classrooms BEFORE UPDATE ON public.classrooms FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_assignments BEFORE UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_user_settings BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_user_stats BEFORE UPDATE ON public.user_stats FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

-- ================================================================
-- ✅ Done. Fully safe for CI/CD, Supabase CLI, and local initialization.
-- Supports staged FK enforcement for clean environment builds.
-- ================================================================