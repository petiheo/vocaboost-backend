-- Migration: Learning and Revision System
-- Author: VocaBoost Backend Team
-- Date: 2025-07-07

BEGIN;

-- User progress for each word (Spaced Repetition)
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
    last_reviewed_at TIMESTAMPTZ,
    difficulty_rating INTEGER, -- User's self-assessment 1-5
    review_context TEXT, -- Which learning mode was used
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (user_id, word_id)
);

-- Learning sessions
CREATE TABLE IF NOT EXISTS public.revision_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL,
    vocab_list_id UUID NOT NULL,
    assignment_id UUID,
    session_type TEXT NOT NULL, -- 'flashcard', 'fill_blank', 'word_association'
    status public.session_status NOT NULL DEFAULT 'in_progress',
    started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    completed_at TIMESTAMPTZ,
    score INT,
    total_words INT DEFAULT 0,
    correct_answers INT DEFAULT 0
);

-- Results for each word in a session
CREATE TABLE IF NOT EXISTS public.session_word_results (
    session_id UUID NOT NULL,
    word_id UUID NOT NULL,
    result TEXT NOT NULL CHECK (result IN ('correct', 'incorrect')),
    response_time_ms INT, -- Time taken to answer
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    PRIMARY KEY (session_id, word_id)
);

INSERT INTO schema_migrations (version, description) 
VALUES ('004', 'Create learning and revision system tables');

COMMIT;