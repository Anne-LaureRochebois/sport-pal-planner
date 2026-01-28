-- Add recurrence fields to sessions table
ALTER TABLE public.sessions
ADD COLUMN recurrence_type TEXT DEFAULT 'none' CHECK (recurrence_type IN ('none', 'daily', 'weekly', 'custom')),
ADD COLUMN recurrence_days INTEGER[] DEFAULT NULL,
ADD COLUMN recurrence_end_date DATE DEFAULT NULL,
ADD COLUMN parent_session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE DEFAULT NULL,
ADD COLUMN is_recurring_instance BOOLEAN DEFAULT false;

-- Add index for parent session lookups
CREATE INDEX idx_sessions_parent_session_id ON public.sessions(parent_session_id);

-- Add reminder_sent tracking to bookings
ALTER TABLE public.bookings
ADD COLUMN reminder_sent BOOLEAN DEFAULT false;

-- Create function to generate recurring session instances
CREATE OR REPLACE FUNCTION public.generate_recurring_sessions(
  p_parent_id UUID,
  p_recurrence_type TEXT,
  p_recurrence_days INTEGER[],
  p_end_date DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent RECORD;
  v_current_date DATE;
  v_day_of_week INTEGER;
BEGIN
  -- Get parent session details
  SELECT * INTO v_parent FROM public.sessions WHERE id = p_parent_id;
  
  IF v_parent IS NULL THEN
    RETURN;
  END IF;
  
  v_current_date := v_parent.session_date + INTERVAL '1 day';
  
  WHILE v_current_date <= p_end_date LOOP
    v_day_of_week := EXTRACT(DOW FROM v_current_date)::INTEGER;
    
    IF p_recurrence_type = 'daily' OR 
       (p_recurrence_type = 'weekly' AND v_day_of_week = EXTRACT(DOW FROM v_parent.session_date)::INTEGER) OR
       (p_recurrence_type = 'custom' AND v_day_of_week = ANY(p_recurrence_days)) THEN
      
      INSERT INTO public.sessions (
        title, description, sport_type, location, session_date, 
        start_time, end_time, max_participants, created_by,
        recurrence_type, recurrence_days, recurrence_end_date, 
        parent_session_id, is_recurring_instance
      ) VALUES (
        v_parent.title, v_parent.description, v_parent.sport_type, v_parent.location,
        v_current_date, v_parent.start_time, v_parent.end_time, v_parent.max_participants,
        v_parent.created_by, 'none', NULL, NULL, p_parent_id, true
      );
    END IF;
    
    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;
END;
$$;

-- Create function to delete all future recurring instances
CREATE OR REPLACE FUNCTION public.delete_future_recurring_sessions(p_parent_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.sessions 
  WHERE parent_session_id = p_parent_id 
    AND session_date > CURRENT_DATE;
END;
$$;