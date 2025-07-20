-- Migration: Indexes and Triggers
-- Author: VocaBoost Backend Team
-- Date: 2025-07-07

BEGIN;

-- === INDEXES ===

-- User-related indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(account_status);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires_at ON public.auth_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_teacher_requests_status ON public.teacher_requests(status);

-- Vocabulary indexes
CREATE INDEX IF NOT EXISTS idx_vocab_lists_creator ON public.vocab_lists(creator_id);
CREATE INDEX IF NOT EXISTS idx_vocab_lists_privacy_active ON public.vocab_lists(privacy_setting) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_vocabulary_term_search ON public.vocabulary USING gin(term gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_vocabulary_list ON public.vocabulary(list_id);
CREATE INDEX IF NOT EXISTS idx_vocabulary_examples_vocab ON public.vocabulary_examples(vocabulary_id);

-- Learning system indexes
CREATE INDEX IF NOT EXISTS idx_user_word_progress_review_queue ON public.user_word_progress(user_id, next_review_date ASC);
CREATE INDEX IF NOT EXISTS idx_user_word_progress_user_word ON public.user_word_progress(user_id, word_id);
CREATE INDEX IF NOT EXISTS idx_revision_sessions_user ON public.revision_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_revision_sessions_assignment ON public.revision_sessions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_session_results_session ON public.session_word_results(session_id);

-- Classroom indexes
CREATE INDEX IF NOT EXISTS idx_classrooms_teacher ON public.classrooms(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classroom_members_classroom ON public.classroom_members(classroom_id);
CREATE INDEX IF NOT EXISTS idx_classroom_members_learner ON public.classroom_members(learner_id);
CREATE INDEX IF NOT EXISTS idx_assignments_classroom ON public.assignments(classroom_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON public.assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_learner_assignments_learner ON public.learner_assignments(learner_id);

-- System utilities indexes
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(recipient_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);

-- === TRIGGERS ===

-- Update timestamps
CREATE TRIGGER set_timestamp_users BEFORE UPDATE ON public.users 
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_user_settings BEFORE UPDATE ON public.user_settings 
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_user_stats BEFORE UPDATE ON public.user_stats 
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_vocab_lists BEFORE UPDATE ON public.vocab_lists 
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_vocabulary BEFORE UPDATE ON public.vocabulary 
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_user_word_progress BEFORE UPDATE ON public.user_word_progress 
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_classrooms BEFORE UPDATE ON public.classrooms 
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_assignments BEFORE UPDATE ON public.assignments 
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

INSERT INTO schema_migrations (version, description) 
VALUES ('008', 'Add indexes and triggers');

COMMIT;