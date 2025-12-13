-- =====================================================
-- SECURITY HARDENING: Strengthen RLS Policies
-- =====================================================

-- 1. Ensure all tables explicitly require authentication
-- Drop overly permissive "Anyone can view" policies and replace with authenticated-only

-- Drop public view policies and replace with authenticated-only
DROP POLICY IF EXISTS "Anyone can view categories" ON public.categories;
CREATE POLICY "Authenticated users can view categories" 
ON public.categories FOR SELECT 
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can view combo components" ON public.combo_components;
CREATE POLICY "Authenticated users can view combo components" 
ON public.combo_components FOR SELECT 
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can view combo products" ON public.combo_products;
CREATE POLICY "Authenticated users can view combo products" 
ON public.combo_products FOR SELECT 
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can view adjustments" ON public.inventory_adjustments;
CREATE POLICY "Staff can view inventory adjustments" 
ON public.inventory_adjustments FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'cashier'::app_role)
);

DROP POLICY IF EXISTS "Anyone can view active modifier groups" ON public.modifier_groups;
CREATE POLICY "Authenticated users can view active modifier groups" 
ON public.modifier_groups FOR SELECT 
USING (auth.uid() IS NOT NULL AND (is_active = true OR has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "Anyone can view available modifiers" ON public.modifiers;
CREATE POLICY "Authenticated users can view available modifiers" 
ON public.modifiers FOR SELECT 
USING (auth.uid() IS NOT NULL AND (is_available = true OR has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "Anyone can view product modifiers" ON public.product_modifiers;
CREATE POLICY "Authenticated users can view product modifiers" 
ON public.product_modifiers FOR SELECT 
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can view active promotions" ON public.promotions;
CREATE POLICY "Authenticated users can view active promotions" 
ON public.promotions FOR SELECT 
USING (auth.uid() IS NOT NULL AND (is_active = true OR has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "Anyone can view active products" ON public.products;
CREATE POLICY "Authenticated users can view active products" 
ON public.products FOR SELECT 
USING (auth.uid() IS NOT NULL AND (is_active = true OR has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "Everyone can view active floor plans" ON public.floor_plans;
CREATE POLICY "Authenticated users can view active floor plans" 
ON public.floor_plans FOR SELECT 
USING (auth.uid() IS NOT NULL AND (is_active = true OR has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "Everyone can view active tables" ON public.restaurant_tables;
CREATE POLICY "Authenticated users can view active tables" 
ON public.restaurant_tables FOR SELECT 
USING (auth.uid() IS NOT NULL AND (is_active = true OR has_role(auth.uid(), 'admin'::app_role)));

-- 2. Remove duplicate/redundant policies
DROP POLICY IF EXISTS "Authenticated users can read printer logs" ON public.printer_logs;

-- 3. Strengthen waitlist access - restrict to waiter and admin only
DROP POLICY IF EXISTS "Admins and waiters can view waitlist" ON public.waitlist;
DROP POLICY IF EXISTS "Admins and waiters can insert waitlist" ON public.waitlist;
DROP POLICY IF EXISTS "Admins and waiters can update waitlist" ON public.waitlist;

CREATE POLICY "Staff can view waitlist" 
ON public.waitlist FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'waiter'::app_role));

CREATE POLICY "Staff can create waitlist entries" 
ON public.waitlist FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'waiter'::app_role));

CREATE POLICY "Staff can update waitlist entries" 
ON public.waitlist FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'waiter'::app_role));

-- 4. Restrict profiles access - only admin can see others, users can see own
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Users can view own profile or admins can view all" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id OR has_role(auth.uid(), 'admin'::app_role));

-- 5. Ensure pin_hash is never exposed via profiles_safe view (verify it exists correctly)
DROP VIEW IF EXISTS public.profiles_safe;
CREATE VIEW public.profiles_safe AS
SELECT 
  id,
  full_name,
  role,
  created_at,
  updated_at
FROM public.profiles
WHERE has_role(auth.uid(), 'admin'::app_role) 
   OR has_role(auth.uid(), 'waiter'::app_role)
   OR has_role(auth.uid(), 'cashier'::app_role)
   OR has_role(auth.uid(), 'kitchen'::app_role)
   OR auth.uid() = id;

-- Grant access to the view
GRANT SELECT ON public.profiles_safe TO authenticated;

COMMENT ON VIEW public.profiles_safe IS 'Safe view of profiles that excludes pin_hash. Use this instead of querying profiles directly.';

-- 6. Add comment for security documentation
COMMENT ON TABLE public.profiles IS 'User profiles with sensitive pin_hash. Access via profiles_safe view for non-admin queries.';