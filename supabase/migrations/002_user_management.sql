-- Migration: User Management Tables
-- Author: VocaBoost Backend Team
-- Date: 2025-07-07

BEGIN;

-- Main users table
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
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- User deactivation tracking
CREATE TABLE IF NOT EXISTS public.user_deactivation (
    user_id UUID,
    deactivated_by UUID NOT NULL,
    deactivated_at TIMESTAMPTZ DEFAULT now(),
    deactivation_reason TEXT,
    PRIMARY KEY (user_id, deactivated_by)
);

-- User settings
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY,
    daily_goal INTEGER DEFAULT 10, 
    timezone VARCHAR(50) DEFAULT 'Asia/Ho_Chi_Minh',
    language VARCHAR(10) DEFAULT 'vi',
    theme VARCHAR(20) DEFAULT 'light',
    notification_preferences JSONB DEFAULT '{"email": true, "push": false}',
    learning_preferences JSONB DEFAULT '{"preferred_methods": ["flashcard"], "session_length": 20}',
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- User statistics
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

-- Teacher verification requests
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

-- Authentication tokens
CREATE TABLE IF NOT EXISTS public.auth_tokens (
    token TEXT PRIMARY KEY,
    user_id UUID NOT NULL,
    token_type public.token_type NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    used_at TIMESTAMPTZ
);

INSERT INTO schema_migrations (version, description) 
VALUES ('002', 'Create user management tables');

COMMIT;
