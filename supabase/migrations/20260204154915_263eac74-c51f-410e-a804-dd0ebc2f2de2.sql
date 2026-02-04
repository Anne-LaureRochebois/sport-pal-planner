-- Add approval status to profiles
ALTER TABLE public.profiles 
ADD COLUMN is_approved boolean NOT NULL DEFAULT false,
ADD COLUMN approved_at timestamp with time zone,
ADD COLUMN approved_by uuid,
ADD COLUMN rejected_at timestamp with time zone,
ADD COLUMN rejected_by uuid;

-- Update existing users to be approved (they were already validated via invite)
UPDATE public.profiles SET is_approved = true, approved_at = now();

-- Update the handle_new_user function to NOT auto-approve
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, is_approved)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name', false);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member');
  
  RETURN NEW;
END;
$function$;

-- Create a function for admins to approve users
CREATE OR REPLACE FUNCTION public.approve_user(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if caller is admin
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can approve users';
  END IF;
  
  UPDATE public.profiles 
  SET is_approved = true, 
      approved_at = now(), 
      approved_by = auth.uid(),
      rejected_at = NULL,
      rejected_by = NULL
  WHERE user_id = p_user_id;
  
  RETURN true;
END;
$function$;

-- Create a function for admins to reject users
CREATE OR REPLACE FUNCTION public.reject_user(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if caller is admin
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can reject users';
  END IF;
  
  UPDATE public.profiles 
  SET is_approved = false,
      rejected_at = now(), 
      rejected_by = auth.uid(),
      approved_at = NULL,
      approved_by = NULL
  WHERE user_id = p_user_id;
  
  RETURN true;
END;
$function$;

-- Update profiles_safe view to include approval status
DROP VIEW IF EXISTS public.profiles_safe;

CREATE VIEW public.profiles_safe
WITH (security_invoker=on) AS
SELECT
  id,
  user_id,
  full_name,
  avatar_url,
  created_at,
  is_approved,
  CASE
    WHEN user_id = auth.uid() THEN email
    ELSE NULL
  END as email
FROM public.profiles;

GRANT SELECT ON public.profiles_safe TO authenticated;
GRANT SELECT ON public.profiles_safe TO anon;