-- Migration: Extensions and Enums
-- Author: VocaBoost Backend Team  
-- Date: 2025-07-07

BEGIN;

-- === EXTENSIONS ===
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- === ENUM TYPES ===
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

-- === TRIGGER FUNCTION ===
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Insert migration record
INSERT INTO schema_migrations (version, description) 
VALUES ('001', 'Create extensions, enums and trigger function');

COMMIT;