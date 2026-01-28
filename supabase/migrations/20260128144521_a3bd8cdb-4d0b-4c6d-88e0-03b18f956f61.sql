-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('booking_created', 'booking_cancelled', 'session_modified', 'session_cancelled')),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  actor_id UUID,
  actor_name TEXT,
  session_title TEXT,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);

-- System can insert notifications (via trigger with security definer)
CREATE POLICY "System can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create index for faster queries
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Function to notify session creator when a booking is created
CREATE OR REPLACE FUNCTION public.notify_booking_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_booker RECORD;
BEGIN
  -- Get session details
  SELECT id, title, created_by INTO v_session
  FROM public.sessions
  WHERE id = NEW.session_id;
  
  -- Don't notify if the creator books their own session
  IF v_session.created_by = NEW.user_id OR v_session.created_by IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get booker details
  SELECT full_name, email INTO v_booker
  FROM public.profiles
  WHERE user_id = NEW.user_id;
  
  -- Create notification for session creator
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
$$;

-- Function to notify session creator when a booking is cancelled
CREATE OR REPLACE FUNCTION public.notify_booking_cancelled()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_booker RECORD;
BEGIN
  -- Get session details
  SELECT id, title, created_by INTO v_session
  FROM public.sessions
  WHERE id = OLD.session_id;
  
  -- Don't notify if the creator cancels their own booking
  IF v_session.created_by = OLD.user_id OR v_session.created_by IS NULL THEN
    RETURN OLD;
  END IF;
  
  -- Get booker details
  SELECT full_name, email INTO v_booker
  FROM public.profiles
  WHERE user_id = OLD.user_id;
  
  -- Create notification for session creator
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
$$;

-- Function to notify all booked users when a session is modified
CREATE OR REPLACE FUNCTION public.notify_session_modified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organizer RECORD;
  v_booking RECORD;
BEGIN
  -- Check if relevant fields changed
  IF OLD.title = NEW.title 
     AND OLD.session_date = NEW.session_date 
     AND OLD.start_time = NEW.start_time 
     AND OLD.end_time = NEW.end_time 
     AND OLD.location = NEW.location THEN
    RETURN NEW;
  END IF;
  
  -- Get organizer details
  SELECT full_name, email INTO v_organizer
  FROM public.profiles
  WHERE user_id = NEW.created_by;
  
  -- Notify all booked users (except the organizer)
  FOR v_booking IN 
    SELECT user_id FROM public.bookings WHERE session_id = NEW.id AND user_id != NEW.created_by
  LOOP
    INSERT INTO public.notifications (user_id, type, session_id, actor_id, actor_name, session_title, message)
    VALUES (
      v_booking.user_id,
      'session_modified',
      NEW.id,
      NEW.created_by,
      COALESCE(v_organizer.full_name, v_organizer.email),
      NEW.title,
      'La séance "' || NEW.title || '" a été modifiée par l''organisateur'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Function to notify all booked users when a session is cancelled/deleted
CREATE OR REPLACE FUNCTION public.notify_session_cancelled()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organizer RECORD;
  v_booking RECORD;
BEGIN
  -- Get organizer details
  SELECT full_name, email INTO v_organizer
  FROM public.profiles
  WHERE user_id = OLD.created_by;
  
  -- Notify all booked users (except the organizer)
  FOR v_booking IN 
    SELECT user_id FROM public.bookings WHERE session_id = OLD.id AND user_id != OLD.created_by
  LOOP
    INSERT INTO public.notifications (user_id, type, session_id, actor_id, actor_name, session_title, message)
    VALUES (
      v_booking.user_id,
      'session_cancelled',
      NULL, -- Session is being deleted
      OLD.created_by,
      COALESCE(v_organizer.full_name, v_organizer.email),
      OLD.title,
      'La séance "' || OLD.title || '" a été annulée par l''organisateur'
    );
  END LOOP;
  
  RETURN OLD;
END;
$$;

-- Create triggers
CREATE TRIGGER on_booking_created
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_booking_created();

CREATE TRIGGER on_booking_cancelled
  AFTER DELETE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_booking_cancelled();

CREATE TRIGGER on_session_modified
  AFTER UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_session_modified();

CREATE TRIGGER on_session_cancelled
  BEFORE DELETE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_session_cancelled();