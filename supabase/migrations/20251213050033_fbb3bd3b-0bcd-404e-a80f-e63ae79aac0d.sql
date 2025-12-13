-- Fix security definer view by setting security_invoker = true
-- This ensures the view uses the calling user's permissions, not the view owner's

ALTER VIEW public.profiles_safe SET (security_invoker = true);

-- Verify the view is properly configured
COMMENT ON VIEW public.profiles_safe IS 'Safe view of profiles excluding pin_hash. Uses security_invoker to respect RLS policies of the calling user.';