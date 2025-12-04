-- Add pin_hash column to profiles table for PIN-based authentication
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pin_hash text;

-- Drop and recreate the handle_new_user function to always assign 'cashier' role
-- This prevents privilege escalation by ignoring any role sent from client
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Always insert profile with 'cashier' role - ignore any client-provided role
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    'cashier'::user_role
  );
  
  -- Always insert user_roles with 'cashier' role - ignore any client-provided role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'cashier'::app_role);
  
  RETURN NEW;
END;
$$;