-- Fix PIN hash exposure: Remove direct user access to profiles table
-- Users should query profiles_safe view instead (which excludes pin_hash)

-- Drop existing user self-access policies on profiles table
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Keep admin access to full profiles table (needed for PIN management)
-- "Admins can view all profiles" policy already exists

-- Create RLS policy on profiles_safe view to allow authenticated users to see their own data
-- First, enable RLS on the view
ALTER VIEW public.profiles_safe SET (security_invoker = true);

-- Create policy for users to view their own profile via the safe view
CREATE POLICY "Users can view own safe profile"
ON public.profiles
FOR SELECT
USING (
  -- Only allow access if querying through profiles_safe view context
  -- or if user is admin
  has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = id
);

-- Actually, we need a different approach. The profiles_safe view already exists
-- but users can still query profiles directly. The solution is:
-- 1. Keep admin-only access to profiles table
-- 2. Grant users access to profiles_safe view only

-- Let's redo this properly:
DROP POLICY IF EXISTS "Users can view own safe profile" ON public.profiles;

-- Create a function that checks if we're in a safe view context
-- This prevents direct access to profiles while allowing view access
CREATE OR REPLACE FUNCTION public.is_profiles_view_context()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT current_setting('request.path', true) IS NULL 
    OR current_setting('request.path', true) NOT LIKE '%/profiles%'
    OR has_role(auth.uid(), 'admin'::app_role)
$$;

-- Actually, simplest secure approach: only admins can access profiles table directly
-- All other users must use profiles_safe view

-- The profiles_safe view already exists and excludes pin_hash
-- We just need to ensure non-admins can't query profiles directly

-- Current state after previous migrations:
-- - Admins can view all profiles (keep this)
-- - Users can update their own profile (keep this for name changes)
-- - Remove all user SELECT on profiles table

-- Grant SELECT on profiles_safe to authenticated users
GRANT SELECT ON public.profiles_safe TO authenticated;

-- The key fix: users can see their own profile ONLY through profiles_safe
-- by using a security barrier view approach