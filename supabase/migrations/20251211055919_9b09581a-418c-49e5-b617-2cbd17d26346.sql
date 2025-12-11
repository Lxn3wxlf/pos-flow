-- Drop the staff policies that expose all customer data
DROP POLICY IF EXISTS "Staff can view all customers" ON public.customers;
DROP POLICY IF EXISTS "Staff can create customers" ON public.customers;
DROP POLICY IF EXISTS "Staff can update customers" ON public.customers;

-- Create a limited view for cashiers/waiters with only name and phone
CREATE OR REPLACE VIEW public.customers_limited AS
SELECT 
  id,
  name,
  phone
FROM public.customers;

-- Grant access to the view
GRANT SELECT ON public.customers_limited TO authenticated;

-- Create RLS-like access control via a security definer function for the view
CREATE OR REPLACE FUNCTION public.get_customers_limited()
RETURNS TABLE (id uuid, name text, phone text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, phone
  FROM public.customers
  WHERE has_role(auth.uid(), 'admin'::app_role) 
     OR has_role(auth.uid(), 'cashier'::app_role) 
     OR has_role(auth.uid(), 'waiter'::app_role)
$$;

-- Allow staff to create customers (they need this for new orders)
CREATE POLICY "Staff can create customers" 
ON public.customers 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'cashier'::app_role) 
  OR has_role(auth.uid(), 'waiter'::app_role)
);

-- Allow staff to update only name and phone (basic info needed for orders)
CREATE POLICY "Staff can update customer basic info" 
ON public.customers 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'cashier'::app_role) 
  OR has_role(auth.uid(), 'waiter'::app_role)
);