-- Migration: Vocabulary Management Tables
-- Author: VocaBoost Backend Team
-- Date: 2025-07-07

BEGIN;

-- Vocabulary lists
CREATE TABLE IF NOT EXISTS public.vocab_lists (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    creator_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    word_count INT DEFAULT 0,
    privacy_setting public.privacy_setting NOT NULL DEFAULT 'private',
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Individual vocabulary words
CREATE TABLE IF NOT EXISTS public.vocabulary (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    list_id UUID NOT NULL,
    created_by UUID,
    term TEXT NOT NULL,
    definition TEXT NOT NULL,
    phonetics TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Example sentences for vocabulary
CREATE TABLE IF NOT EXISTS public.vocabulary_examples (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    vocabulary_id UUID NOT NULL,
    example_sentence TEXT NOT NULL,
    translation TEXT,
    ai_generated BOOLEAN DEFAULT FALSE,
    generation_prompt TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Word synonyms
CREATE TABLE IF NOT EXISTS public.word_synonyms (
    word_id UUID NOT NULL,
    synonym TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    PRIMARY KEY (word_id, synonym)
);

-- Tags for categorization
CREATE TABLE IF NOT EXISTS public.tags (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color VARCHAR(7) DEFAULT '#007bff'
);

-- List-tag associations
CREATE TABLE IF NOT EXISTS public.list_tags (
    list_id UUID NOT NULL,
    tag_id INT NOT NULL,
    PRIMARY KEY (list_id, tag_id)
);

-- AI generations tracking
CREATE TABLE IF NOT EXISTS public.ai_generations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    vocabulary_id UUID NOT NULL,
    generation_type TEXT NOT NULL, -- 'example', 'definition', 'collocation'
    prompt TEXT,
    generated_content TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

INSERT INTO schema_migrations (version, description) 
VALUES ('003', 'Create vocabulary management tables');

COMMIT;