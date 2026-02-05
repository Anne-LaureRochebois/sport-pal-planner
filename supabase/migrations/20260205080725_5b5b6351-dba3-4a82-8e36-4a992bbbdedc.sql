-- Drop the existing check constraint
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Recreate it with all needed types including the existing ones
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('booking', 'cancellation', 'session_update', 'comment', 'reminder', 'new_user_pending', 'booking_created', 'booking_cancelled', 'session_modified', 'session_cancelled'));