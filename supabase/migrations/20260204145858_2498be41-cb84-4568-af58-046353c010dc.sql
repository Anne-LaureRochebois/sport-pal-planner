-- ===========================================
-- FIX #1: Add length constraint on session_comments
-- ===========================================
ALTER TABLE public.session_comments 
ADD CONSTRAINT content_length_check 
CHECK (char_length(content) <= 2000 AND char_length(content) > 0);

-- ===========================================
-- FIX #2: Add input validation to generate_recurring_sessions function
-- ===========================================
CREATE OR REPLACE FUNCTION public.generate_recurring_sessions(p_parent_id uuid, p_recurrence_type text, p_recurrence_days integer[], p_end_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent RECORD;
  v_current_date DATE;
  v_day_of_week INTEGER;
  v_count INTEGER := 0;
  v_max_instances INTEGER := 365;
  v_max_period INTERVAL := INTERVAL '2 years';
BEGIN
  -- Get parent session details
  SELECT * INTO v_parent FROM public.sessions WHERE id = p_parent_id;
  
  IF v_parent IS NULL THEN
    RETURN;
  END IF;
  
  -- Validate: Only session creator can generate recurring sessions
  IF v_parent.created_by != auth.uid() THEN
    RAISE EXCEPTION 'Only session creator can generate recurring instances';
  END IF;
  
  -- Validate: Recurrence period cannot exceed 2 years
  IF p_end_date - v_parent.session_date > v_max_period THEN
    RAISE EXCEPTION 'Recurrence period too long (maximum 2 years)';
  END IF;
  
  -- Validate: End date must be after session date
  IF p_end_date <= v_parent.session_date THEN
    RAISE EXCEPTION 'End date must be after session date';
  END IF;
  
  -- Validate: Recurrence type must be valid
  IF p_recurrence_type NOT IN ('daily', 'weekly', 'custom') THEN
    RAISE EXCEPTION 'Invalid recurrence type';
  END IF;
  
  v_current_date := v_parent.session_date + INTERVAL '1 day';
  
  WHILE v_current_date <= p_end_date AND v_count < v_max_instances LOOP
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
      
      v_count := v_count + 1;
    END IF;
    
    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;
  
  -- Log if maximum was reached
  IF v_count >= v_max_instances THEN
    RAISE WARNING 'Maximum recurring instances limit reached (%)' , v_max_instances;
  END IF;
END;
$$;