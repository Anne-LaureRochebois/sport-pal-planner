-- Create a function to notify admins when a new user registers
CREATE OR REPLACE FUNCTION public.notify_admins_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin RECORD;
BEGIN
  -- Notify all admins about the new user registration
  FOR v_admin IN 
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, type, actor_id, actor_name, message)
    VALUES (
      v_admin.user_id,
      'new_user_pending',
      NEW.user_id,
      COALESCE(NEW.full_name, NEW.email),
      'Nouvel utilisateur en attente de validation : ' || COALESCE(NEW.full_name, NEW.email)
    );
  END LOOP;
  
  RETURN NEW;
END;
$function$;

-- Create trigger to call this function when a new profile is created
DROP TRIGGER IF EXISTS on_new_user_notify_admins ON public.profiles;
CREATE TRIGGER on_new_user_notify_admins
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  WHEN (NEW.is_approved = false)
  EXECUTE FUNCTION public.notify_admins_new_user();