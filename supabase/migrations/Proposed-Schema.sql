-- =================================================================
-- VocaBoost Database Schema
-- Version: 1.0
-- Description: This script creates all tables, types, and relationships
-- for the VocaBoost application based on the final ER diagram.
-- =================================================================

-- Step 0: Create Custom ENUM Types for Data Integrity (can only have predefined values)
-- -----------------------------------------------------------------

CREATE TYPE public.user_role AS ENUM ('learner', 'teacher', 'admin');
CREATE TYPE public.account_status AS ENUM ('pending_verification', 'active', 'suspended');
CREATE TYPE public.verification_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.privacy_setting AS ENUM ('private', 'public', 'classroom_only');
CREATE TYPE public.session_status AS ENUM ('in_progress', 'completed', 'interrupted');
CREATE TYPE public.join_status AS ENUM ('pending_approval', 'approved');
CREATE TYPE public.assignment_status AS ENUM ('not_started', 'in_progress', 'completed', 'late');
CREATE TYPE public.report_content_type AS ENUM ('vocab_list', 'word', 'user', 'classroom');
CREATE TYPE public.report_status AS ENUM ('open', 'resolved', 'dismissed');
CREATE TYPE public.token_type AS ENUM ('email_verification', 'password_reset');


-- Step 1: Core User & Profile Tables
-- -----------------------------------------------------------------
-- This table stores public profile information and application-specific data,
-- extending the built-in Supabase 'auth.users' table.
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    role public.user_role NOT NULL DEFAULT 'learner',
    account_status public.account_status NOT NULL DEFAULT 'pending_verification',
    learning_target_per_day INT,
    last_seen_at TIMESTAMPTZ
);
COMMENT ON TABLE public.profiles IS 'Stores user profile data linked to Supabase auth users.';


-- Stores additional information for users with the 'teacher' role.
CREATE TABLE public.teachers_info (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    verification_status public.verification_status NOT NULL DEFAULT 'pending',
    institution TEXT,
    credentials_url TEXT, -- Link to submitted files in Supabase Storage
    rejection_reason TEXT
);
COMMENT ON TABLE public.teachers_info IS 'Verification and professional data for teachers.';


-- Step 2: Vocabulary Content Tables
-- -----------------------------------------------------------------
-- Stores user-created vocabulary lists.
CREATE TABLE public.vocab_lists (
    id BIGSERIAL PRIMARY KEY,
    creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    privacy_setting public.privacy_setting NOT NULL DEFAULT 'private',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.vocab_lists IS 'Container for a collection of words created by a user.';


-- Stores individual vocabulary words. This is existence-dependent on vocab_lists.
CREATE TABLE public.words (
    id BIGSERIAL PRIMARY KEY,
    list_id BIGINT NOT NULL REFERENCES public.vocab_lists(id) ON DELETE CASCADE,
    term TEXT NOT NULL,
    definition TEXT NOT NULL,
    phonetics TEXT,
    example_sentence TEXT,
    image_url TEXT,
    audio_url TEXT
);
COMMENT ON TABLE public.words IS 'Individual vocabulary items belonging to a list.';


-- Weak entity storing synonyms for words to support word association exercises.
CREATE TABLE public.word_synonyms (
    word_id BIGINT NOT NULL REFERENCES public.words(id) ON DELETE CASCADE,
    synonym TEXT NOT NULL,
    PRIMARY KEY (word_id, synonym)
);
COMMENT ON TABLE public.word_synonyms IS 'Synonyms associated with a specific word.';


-- Lookup table for tags.
CREATE TABLE public.tags (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);
COMMENT ON TABLE public.tags IS 'A list of unique tags for categorizing vocab lists.';


-- Join table for the many-to-many relationship between lists and tags.
CREATE TABLE public.list_tags (
    list_id BIGINT NOT NULL REFERENCES public.vocab_lists(id) ON DELETE CASCADE,
    tag_id INT NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (list_id, tag_id)
);
COMMENT ON TABLE public.list_tags IS 'Associates tags with vocabulary lists.';


-- Step 3: Learning & Progress Tables
-- -----------------------------------------------------------------
-- Tracks a specific user's Spaced Repetition progress for a specific word.
CREATE TABLE public.user_word_progress (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    word_id BIGINT NOT NULL REFERENCES public.words(id) ON DELETE CASCADE,
    next_review_date TIMESTAMPTZ DEFAULT now() NOT NULL,
    interval_days INT DEFAULT 1 NOT NULL,
    ease_factor REAL DEFAULT 2.5 NOT NULL,
    repetitions INT DEFAULT 0 NOT NULL,
    correct_count INT DEFAULT 0 NOT NULL,
    incorrect_count INT DEFAULT 0 NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    PRIMARY KEY (user_id, word_id)
);
COMMENT ON TABLE public.user_word_progress IS 'Stores Spaced Repetition data for each user-word pair.';


-- Records a single learning/review session.
CREATE TABLE public.revision_sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    vocab_list_id BIGINT NOT NULL REFERENCES public.vocab_lists(id) ON DELETE CASCADE,
    assignment_id BIGINT REFERENCES public.assignments(id) ON DELETE SET NULL, -- Nullable
    session_type TEXT NOT NULL, -- e.g., 'flashcard', 'fill_in_blank'
    status public.session_status NOT NULL DEFAULT 'in_progress',
    started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    completed_at TIMESTAMPTZ,
    score INT
);
COMMENT ON TABLE public.revision_sessions IS 'Logs each study session undertaken by a user.';


-- Granular log of each interaction within a session for detailed analysis and resuming.
CREATE TABLE public.session_word_results (
    session_id BIGINT NOT NULL REFERENCES public.revision_sessions(id) ON DELETE CASCADE,
    word_id BIGINT NOT NULL REFERENCES public.words(id) ON DELETE CASCADE,
    result TEXT NOT NULL CHECK (result IN ('correct', 'incorrect')),
    "timestamp" TIMESTAMPTZ DEFAULT now() NOT NULL,
    PRIMARY KEY (session_id, word_id)
);
COMMENT ON TABLE public.session_word_results IS 'Tracks the result of each word reviewed within a session.';


-- Step 4: Classroom & Assignment Tables
-- -----------------------------------------------------------------
-- Defines a classroom created by a teacher.
CREATE TABLE public.classrooms (
    id BIGSERIAL PRIMARY KEY,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    join_code TEXT UNIQUE,
    is_auto_approval_enabled BOOLEAN DEFAULT false NOT NULL,
    capacity_limit INT
);
COMMENT ON TABLE public.classrooms IS 'A virtual classroom managed by a teacher.';


-- Associative entity for the many-to-many relationship between classrooms and students.
CREATE TABLE public.classroom_members (
    classroom_id BIGINT NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    join_status public.join_status NOT NULL DEFAULT 'pending_approval',
    PRIMARY KEY (classroom_id, student_id)
);
COMMENT ON TABLE public.classroom_members IS 'Links students to classrooms, managing membership.';


-- Defines an exercise or task assigned by a teacher to a classroom.
CREATE TABLE public.assignments (
    id BIGSERIAL PRIMARY KEY,
    classroom_id BIGINT NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
    vocab_list_id BIGINT NOT NULL REFERENCES public.vocab_lists(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    exercise_method TEXT NOT NULL,
    start_date TIMESTAMPTZ DEFAULT now() NOT NULL,
    due_date TIMESTAMPTZ
);
COMMENT ON TABLE public.assignments IS 'An exercise assigned by a teacher to a classroom.';


-- Tracks the progress of each student on a specific assignment.
CREATE TABLE public.student_assignments (
    assignment_id BIGINT NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status public.assignment_status NOT NULL DEFAULT 'not_started',
    score INT,
    completed_at TIMESTAMPTZ,
    PRIMARY KEY (assignment_id, student_id)
);
COMMENT ON TABLE public.student_assignments IS 'Tracks individual student progress on assignments.';


-- Step 5: System & Utility Tables
-- -----------------------------------------------------------------
-- Logs user-generated reports for content moderation by admins.
CREATE TABLE public.reports (
    id BIGSERIAL PRIMARY KEY,
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content_type public.report_content_type NOT NULL,
    content_id BIGINT NOT NULL, -- The ID of the reported item (e.g., word_id, list_id)
    reason TEXT,
    status public.report_status NOT NULL DEFAULT 'open',
    resolver_id UUID REFERENCES public.profiles(id), -- Admin who handled it
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.reports IS 'Stores user-submitted reports for content moderation.';


-- System audit trail for important actions.
CREATE TABLE public.audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id), -- Can be null for system actions
    action TEXT NOT NULL, -- e.g., 'user_login', 'classroom_created'
    target_type TEXT,
    target_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.audit_logs IS 'A trail of important actions for security and debugging.';


-- Manages in-app notifications for users.
CREATE TABLE public.notifications (
    id BIGSERIAL PRIMARY KEY,
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    "type" TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX idx_notifications_recipient_id ON public.notifications(recipient_id);
COMMENT ON TABLE public.notifications IS 'User-facing in-app notifications.';


-- Manages single-use, expiring tokens for secure actions.
CREATE TABLE public.tokens (
    token TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type public.token_type NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
);
CREATE INDEX idx_tokens_expires_at ON public.tokens(expires_at);
COMMENT ON TABLE public.tokens IS 'Secure, single-use tokens for actions like email verification.';


-- =================================================================
-- Step 6: Enable Row Level Security (RLS)
-- IMPORTANT: This is a critical security step for a multi-tenant app.
-- Policies must be created separately to define access rules.
-- =================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocab_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.word_synonyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_word_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revision_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_word_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;

-- Note: 'tags' and 'audit_logs' might not need RLS if they are managed
-- only by server-side admin logic, but enabling it provides default protection.
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- Script Complete
-- Next Steps:
-- 1. Create a function to auto-create a profile on new user signup.
-- 2. Define RLS policies for each table to control data access.
-- =================================================================