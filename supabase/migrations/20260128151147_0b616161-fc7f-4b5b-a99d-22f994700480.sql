-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create session_comments table
CREATE TABLE public.session_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.session_comments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view comments"
ON public.session_comments FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create comments"
ON public.session_comments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments"
ON public.session_comments FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users or organizers can delete comments"
ON public.session_comments FOR DELETE
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM public.sessions 
    WHERE id = session_id AND created_by = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Trigger for updated_at
CREATE TRIGGER update_session_comments_updated_at
BEFORE UPDATE ON public.session_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_comments;