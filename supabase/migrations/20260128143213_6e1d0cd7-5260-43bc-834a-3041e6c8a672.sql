-- Drop existing insert policy for sessions
DROP POLICY IF EXISTS "Admins can create sessions" ON public.sessions;

-- Create new policy allowing both admins and members to create sessions
CREATE POLICY "Authenticated users can create sessions" 
ON public.sessions 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Update policy for update - admins or session creator can update
DROP POLICY IF EXISTS "Admins can update sessions" ON public.sessions;
CREATE POLICY "Admins or creators can update sessions" 
ON public.sessions 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = created_by);

-- Update policy for delete - admins or session creator can delete
DROP POLICY IF EXISTS "Admins can delete sessions" ON public.sessions;
CREATE POLICY "Admins or creators can delete sessions" 
ON public.sessions 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = created_by);