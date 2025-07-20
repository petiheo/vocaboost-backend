-- Migration tracking table
-- Author: VocaBoost Backend Team
-- Date: 2025-07-07

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    applied_by TEXT DEFAULT current_user,
    description TEXT
);

-- Insert initial migration record
INSERT INTO schema_migrations (version, description) 
VALUES ('000', 'Create migration tracking table')
ON CONFLICT (version) DO NOTHING;