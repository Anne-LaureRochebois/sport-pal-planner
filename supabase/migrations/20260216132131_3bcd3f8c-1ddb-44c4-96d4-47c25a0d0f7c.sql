
-- Add rate limiting to notification triggers to prevent spam via rapid booking/unbooking

CREATE OR REPLACE FUNCTION public.notify_booking_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_session RECORD;
  v_booker RECORD;
  v_recent_count INTEGER;
BEGIN
  SELECT id, title, created_by INTO v_session
  FROM public.sessions WHERE id = NEW.session_id;
  
  IF v_session.created_by = NEW.user_id OR v_session.created_by IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Rate limit: max 1 notification per session per user per minute
  SELECT COUNT(*) INTO v_recent_count
  FROM public.notifications
  WHERE user_id = v_session.created_by
    AND session_id = v_session.id
    AND actor_id = NEW.user_id
    AND type = 'booking_created'
    AND created_at > NOW() - INTERVAL '1 minute';
  
  IF v_recent_count > 0 THEN
    RETURN NEW;
  END IF;
  
  SELECT full_name, email INTO v_booker
  FROM public.profiles WHERE user_id = NEW.user_id;
  
  INSERT INTO public.notifications (user_id, type, session_id, actor_id, actor_name, session_title, message)
  VALUES (
    v_session.created_by,
    'booking_created',
    v_session.id,
    NEW.user_id,
    COALESCE(v_booker.full_name, v_booker.email),
    v_session.title,
    COALESCE(v_booker.full_name, v_booker.email) || ' s''est inscrit(e) à votre séance "' || v_session.title || '"'
  );
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_booking_cancelled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_session RECORD;
  v_booker RECORD;
  v_recent_count INTEGER;
BEGIN
  SELECT id, title, created_by INTO v_session
  FROM public.sessions WHERE id = OLD.session_id;
  
  IF v_session.created_by = OLD.user_id OR v_session.created_by IS NULL THEN
    RETURN OLD;
  END IF;
  
  -- Rate limit: max 1 notification per session per user per minute
  SELECT COUNT(*) INTO v_recent_count
  FROM public.notifications
  WHERE user_id = v_session.created_by
    AND session_id = v_session.id
    AND actor_id = OLD.user_id
    AND type = 'booking_cancelled'
    AND created_at > NOW() - INTERVAL '1 minute';
  
  IF v_recent_count > 0 THEN
    RETURN OLD;
  END IF;
  
  SELECT full_name, email INTO v_booker
  FROM public.profiles WHERE user_id = OLD.user_id;
  
  INSERT INTO public.notifications (user_id, type, session_id, actor_id, actor_name, session_title, message)
  VALUES (
    v_session.created_by,
    'booking_cancelled',
    v_session.id,
    OLD.user_id,
    COALESCE(v_booker.full_name, v_booker.email),
    v_session.title,
    COALESCE(v_booker.full_name, v_booker.email) || ' a annulé sa réservation pour "' || v_session.title || '"'
  );
  
  RETURN OLD;
END;
$function$;
