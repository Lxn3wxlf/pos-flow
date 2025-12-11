-- Drop the security definer view and recreate without it
DROP VIEW IF EXISTS public.profiles_safe;

-- Create a regular view instead (not security definer)
CREATE VIEW public.profiles_safe 
WITH (security_invoker = true) AS
SELECT id, full_name, role, created_at, updated_at
FROM public.profiles;

-- Grant access to the safe view
GRANT SELECT ON public.profiles_safe TO authenticated;