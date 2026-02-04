-- Fix the security definer view issue by using security_invoker
DROP VIEW IF EXISTS public.profiles_safe;

CREATE VIEW public.profiles_safe
WITH (security_invoker=on) AS
SELECT 
  id,
  user_id,
  full_name,
  avatar_url,
  created_at,
  CASE 
    WHEN user_id = auth.uid() THEN email 
    ELSE NULL 
  END as email
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.profiles_safe TO authenticated;
GRANT SELECT ON public.profiles_safe TO anon;