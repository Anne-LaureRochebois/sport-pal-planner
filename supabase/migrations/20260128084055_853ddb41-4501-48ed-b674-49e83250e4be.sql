-- Add foreign key from bookings to profiles
ALTER TABLE public.bookings
ADD CONSTRAINT bookings_user_id_profiles_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;