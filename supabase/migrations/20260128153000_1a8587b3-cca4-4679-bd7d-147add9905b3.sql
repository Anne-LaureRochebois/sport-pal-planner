-- Add is_cancelled column to sessions table
ALTER TABLE public.sessions 
ADD COLUMN is_cancelled boolean NOT NULL DEFAULT false;

-- Update notify_session_cancelled to set is_cancelled instead of relying on DELETE
-- The notifications are already handled by the existing trigger