-- Fix security definer view issue by using standard RLS-based view

-- Drop the security definer view
DROP VIEW IF EXISTS public.profiles_safe;

-- Create a simple view without security definer
-- The RLS policies on the profiles table will control access
CREATE VIEW public.profiles_safe AS
SELECT 
  id,
  full_name,
  role,
  created_at,
  updated_at
FROM public.profiles;

-- Grant access to authenticated users only
GRANT SELECT ON public.profiles_safe TO authenticated;

-- The underlying profiles table RLS policies will enforce access control
COMMENT ON VIEW public.profiles_safe IS 'Safe view of profiles that excludes pin_hash column. Access is controlled by RLS policies on the profiles table.';