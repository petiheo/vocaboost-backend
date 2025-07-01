-- Add used_at column to email_verification_tokens
ALTER TABLE email_verification_tokens 
ADD COLUMN used_at TIMESTAMP WITH TIME ZONE;

-- Create index for performance
CREATE INDEX idx_email_verify_used_at ON email_verification_tokens(used_at) WHERE used_at IS NOT NULL;