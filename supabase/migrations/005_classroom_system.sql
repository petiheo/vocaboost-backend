-- Migration: Classroom Management System
-- Author: VocaBoost Backend Team
-- Date: 2025-07-07

BEGIN;

-- Classrooms
CREATE TABLE IF NOT EXISTS public.classrooms (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    teacher_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    join_code TEXT UNIQUE,
    learner_count INT DEFAULT 0,
    assignment_count INT DEFAULT 0,
    classroom_status public.classroom_status NOT NULL DEFAULT 'private',
    is_auto_approval_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    capacity_limit INTEGER DEFAULT 50,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Classroom membership
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

-- Assignments
CREATE TABLE IF NOT EXISTS public.assignments ( -- bổ sung thêm status: pending/ assigned/ overdue
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    classroom_id UUID NOT NULL,
    vocab_list_id UUID NOT NULL,
    teacher_id UUID NOT NULL,
    title TEXT NOT NULL,
    exercise_method TEXT NOT NULL, -- 'flashcard', 'fill_blank', 'word_association'
    words_per_review INT,
    sublist_count INT,
    start_date TIMESTAMPTZ DEFAULT now() NOT NULL,
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Assignment sublists (for breaking large lists)
CREATE TABLE IF NOT EXISTS public.assignment_sublists (
    assignment_id UUID NOT NULL,
    sublist_index INT NOT NULL,
    vocab_list_id UUID NOT NULL, -- (cloned vocab list)
    PRIMARY KEY (assignment_id, sublist_index)
);

-- Learner assignment progress
CREATE TABLE IF NOT EXISTS public.learner_assignments (
    assignment_id UUID NOT NULL,
    learner_id UUID NOT NULL,
    completed_sublist_index INT DEFAULT 0,
    status public.assignment_status NOT NULL DEFAULT 'not_started',
    score INT,
    attempts INT DEFAULT 0,
    completed_at TIMESTAMPTZ,
    PRIMARY KEY (assignment_id, learner_id)
);

-- Classroom invitations
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

INSERT INTO schema_migrations (version, description) 
VALUES ('005', 'Create classroom management system tables');

COMMIT;