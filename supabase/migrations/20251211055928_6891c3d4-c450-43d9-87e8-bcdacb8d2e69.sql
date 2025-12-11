-- Drop the security definer view (not recommended approach)
DROP VIEW IF EXISTS public.customers_limited;

-- The get_customers_limited() function is the correct approach
-- Staff should call this function instead of querying the view directly
COMMENT ON FUNCTION public.get_customers_limited() IS 'Returns limited customer data (id, name, phone) for staff creating orders. Full customer data is only accessible to admins.';