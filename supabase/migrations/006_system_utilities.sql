-- Migration: System Utilities
-- Author: VocaBoost Backend Team
-- Date: 2025-07-07

BEGIN;

-- Content reports
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    reporter_id UUID NOT NULL,
    word_id UUID NOT NULL,
    reason TEXT,
    status public.report_status NOT NULL DEFAULT 'open',
    resolver_id UUID,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    resolved_at TIMESTAMPTZ
);

-- System audit logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID,
    action TEXT NOT NULL,
    target_type TEXT, -- crud, Actions
    target_id TEXT,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- User notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    recipient_id UUID NOT NULL,
    notification_type TEXT NOT NULL, -- 'assignment', 'reminder', 'achievement', 'system'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    metadata JSONB,
    action_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- User achievements (optional gamification)
CREATE TABLE IF NOT EXISTS public.achievements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL,
    achievement_type TEXT NOT NULL, -- 'streak', 'words_learned', 'perfect_session'
    title TEXT NOT NULL,
    description TEXT,
    icon_url TEXT,
    earned_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    metadata JSONB
);

INSERT INTO schema_migrations (version, description) 
VALUES ('006', 'Create system utilities tables');

COMMIT;