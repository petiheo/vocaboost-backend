-- Migration: Foreign Key Constraints
-- Author: VocaBoost Backend Team
-- Date: 2025-07-07

BEGIN;

-- User management foreign keys
ALTER TABLE public.user_settings ADD CONSTRAINT fk_user_settings_user 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_stats ADD CONSTRAINT fk_user_stats_user 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.teacher_requests ADD CONSTRAINT fk_teacher_requests_user 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.teacher_requests ADD CONSTRAINT fk_teacher_requests_reviewer 
    FOREIGN KEY (reviewed_by) REFERENCES public.users(id);
ALTER TABLE public.auth_tokens ADD CONSTRAINT fk_auth_tokens_user 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_deactivation ADD CONSTRAINT fk_user_deactivation_user 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_deactivation ADD CONSTRAINT fk_user_deactivation_deactivated_by 
    FOREIGN KEY (deactivated_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- Vocabulary foreign keys
ALTER TABLE public.vocab_lists ADD CONSTRAINT fk_vocab_lists_creator 
    FOREIGN KEY (creator_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.vocabulary ADD CONSTRAINT fk_vocabulary_list 
    FOREIGN KEY (list_id) REFERENCES public.vocab_lists(id) ON DELETE CASCADE;
ALTER TABLE public.vocabulary ADD CONSTRAINT fk_vocabulary_creator 
    FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE public.vocabulary_examples ADD CONSTRAINT fk_vocab_examples_vocabulary 
    FOREIGN KEY (vocabulary_id) REFERENCES public.vocabulary(id) ON DELETE CASCADE;
ALTER TABLE public.word_synonyms ADD CONSTRAINT fk_word_synonyms_word 
    FOREIGN KEY (word_id) REFERENCES public.vocabulary(id) ON DELETE CASCADE;
ALTER TABLE public.list_tags ADD CONSTRAINT fk_list_tags_list 
    FOREIGN KEY (list_id) REFERENCES public.vocab_lists(id) ON DELETE CASCADE;
ALTER TABLE public.list_tags ADD CONSTRAINT fk_list_tags_tag 
    FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;
ALTER TABLE public.ai_generations ADD CONSTRAINT fk_ai_generations_vocabulary 
    FOREIGN KEY (vocabulary_id) REFERENCES public.vocabulary(id) ON DELETE CASCADE;

-- Learning system foreign keys
ALTER TABLE public.user_word_progress ADD CONSTRAINT fk_user_word_progress_user 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_word_progress ADD CONSTRAINT fk_user_word_progress_word 
    FOREIGN KEY (word_id) REFERENCES public.vocabulary(id) ON DELETE CASCADE;
ALTER TABLE public.revision_sessions ADD CONSTRAINT fk_revision_sessions_user 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.revision_sessions ADD CONSTRAINT fk_revision_sessions_list 
    FOREIGN KEY (vocab_list_id) REFERENCES public.vocab_lists(id) ON DELETE CASCADE;
ALTER TABLE public.revision_sessions ADD CONSTRAINT fk_revision_sessions_assignment 
    FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;
ALTER TABLE public.session_word_results ADD CONSTRAINT fk_session_word_results_session 
    FOREIGN KEY (session_id) REFERENCES public.revision_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.session_word_results ADD CONSTRAINT fk_session_word_results_word 
    FOREIGN KEY (word_id) REFERENCES public.vocabulary(id) ON DELETE CASCADE;

-- Classroom foreign keys
ALTER TABLE public.classrooms ADD CONSTRAINT fk_classrooms_teacher 
    FOREIGN KEY (teacher_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.classroom_members ADD CONSTRAINT fk_classroom_members_classroom 
    FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE CASCADE;
ALTER TABLE public.classroom_members ADD CONSTRAINT fk_classroom_members_learner 
    FOREIGN KEY (learner_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.assignments ADD CONSTRAINT fk_assignments_classroom 
    FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE CASCADE;
ALTER TABLE public.assignments ADD CONSTRAINT fk_assignments_vocab_list 
    FOREIGN KEY (vocab_list_id) REFERENCES public.vocab_lists(id) ON DELETE CASCADE;
ALTER TABLE public.assignments ADD CONSTRAINT fk_assignments_teacher 
    FOREIGN KEY (teacher_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.assignment_sublists ADD CONSTRAINT fk_assignment_sublists_assignment 
    FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;
ALTER TABLE public.assignment_sublists ADD CONSTRAINT fk_assignment_sublists_vocab_list 
    FOREIGN KEY (vocab_list_id) REFERENCES public.vocab_lists(id) ON DELETE CASCADE;
ALTER TABLE public.learner_assignments ADD CONSTRAINT fk_learner_assignments_assignment 
    FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;
ALTER TABLE public.learner_assignments ADD CONSTRAINT fk_learner_assignments_learner 
    FOREIGN KEY (learner_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.classroom_invitations ADD CONSTRAINT fk_classroom_invitations_classroom 
    FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE CASCADE;

-- System utilities foreign keys
ALTER TABLE public.reports ADD CONSTRAINT fk_reports_reporter 
    FOREIGN KEY (reporter_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.reports ADD CONSTRAINT fk_reports_word 
    FOREIGN KEY (word_id) REFERENCES public.vocabulary(id) ON DELETE CASCADE;
ALTER TABLE public.audit_logs ADD CONSTRAINT fk_audit_logs_user 
    FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE public.notifications ADD CONSTRAINT fk_notifications_recipient 
    FOREIGN KEY (recipient_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.achievements ADD CONSTRAINT fk_achievements_user 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

INSERT INTO schema_migrations (version, description) 
VALUES ('007', 'Add foreign key constraints');

COMMIT;