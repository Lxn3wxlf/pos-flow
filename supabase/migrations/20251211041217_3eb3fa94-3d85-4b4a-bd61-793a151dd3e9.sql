-- Drop existing overly permissive policies and create stricter ones

-- =============================================
-- CUSTOMERS TABLE - Restrict to admin only
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can update customers" ON public.customers;
DROP POLICY IF EXISTS "Staff can view customers" ON public.customers;
DROP POLICY IF EXISTS "Staff can manage customers" ON public.customers;

CREATE POLICY "Only admins can view customers"
ON public.customers FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can insert customers"
ON public.customers FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update customers"
ON public.customers FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete customers"
ON public.customers FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- DELIVERY_ADDRESSES TABLE - Restrict to admin only
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view delivery addresses" ON public.delivery_addresses;
DROP POLICY IF EXISTS "Authenticated users can insert delivery addresses" ON public.delivery_addresses;
DROP POLICY IF EXISTS "Authenticated users can update delivery addresses" ON public.delivery_addresses;
DROP POLICY IF EXISTS "Staff can view delivery addresses" ON public.delivery_addresses;
DROP POLICY IF EXISTS "Staff can manage delivery addresses" ON public.delivery_addresses;

CREATE POLICY "Only admins can view delivery addresses"
ON public.delivery_addresses FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can insert delivery addresses"
ON public.delivery_addresses FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update delivery addresses"
ON public.delivery_addresses FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- RESERVATIONS TABLE - Restrict to admin and waiter
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view reservations" ON public.reservations;
DROP POLICY IF EXISTS "Authenticated users can insert reservations" ON public.reservations;
DROP POLICY IF EXISTS "Authenticated users can update reservations" ON public.reservations;
DROP POLICY IF EXISTS "Staff can view reservations" ON public.reservations;
DROP POLICY IF EXISTS "Staff can manage reservations" ON public.reservations;

CREATE POLICY "Admins and waiters can view reservations"
ON public.reservations FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'waiter'));

CREATE POLICY "Admins and waiters can insert reservations"
ON public.reservations FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'waiter'));

CREATE POLICY "Admins and waiters can update reservations"
ON public.reservations FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'waiter'));

-- =============================================
-- WAITLIST TABLE - Restrict to admin and waiter
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view waitlist" ON public.waitlist;
DROP POLICY IF EXISTS "Authenticated users can insert waitlist" ON public.waitlist;
DROP POLICY IF EXISTS "Authenticated users can update waitlist" ON public.waitlist;
DROP POLICY IF EXISTS "Staff can view waitlist" ON public.waitlist;
DROP POLICY IF EXISTS "Staff can manage waitlist" ON public.waitlist;

CREATE POLICY "Admins and waiters can view waitlist"
ON public.waitlist FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'waiter'));

CREATE POLICY "Admins and waiters can insert waitlist"
ON public.waitlist FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'waiter'));

CREATE POLICY "Admins and waiters can update waitlist"
ON public.waitlist FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'waiter'));

-- =============================================
-- PAYMENT_TRANSACTIONS TABLE - Restrict to admin only for viewing
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Authenticated users can insert payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Staff can view payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Staff can insert payment transactions" ON public.payment_transactions;

CREATE POLICY "Only admins can view payment transactions"
ON public.payment_transactions FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can insert payment transactions"
ON public.payment_transactions FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'cashier'));

-- =============================================
-- EOD_SESSIONS TABLE - Own records only for cashiers
-- =============================================
DROP POLICY IF EXISTS "Cashiers can view their own EOD sessions" ON public.eod_sessions;
DROP POLICY IF EXISTS "Cashiers can insert their own EOD sessions" ON public.eod_sessions;
DROP POLICY IF EXISTS "Cashiers can update their own EOD sessions" ON public.eod_sessions;
DROP POLICY IF EXISTS "Admins can view all EOD sessions" ON public.eod_sessions;
DROP POLICY IF EXISTS "Admins can update all EOD sessions" ON public.eod_sessions;
DROP POLICY IF EXISTS "Staff can view EOD sessions" ON public.eod_sessions;
DROP POLICY IF EXISTS "Staff can manage EOD sessions" ON public.eod_sessions;

CREATE POLICY "Cashiers view own EOD sessions only"
ON public.eod_sessions FOR SELECT
TO authenticated
USING (
  cashier_id = auth.uid() OR 
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Cashiers insert own EOD sessions only"
ON public.eod_sessions FOR INSERT
TO authenticated
WITH CHECK (cashier_id = auth.uid());

CREATE POLICY "Cashiers update own pending EOD sessions only"
ON public.eod_sessions FOR UPDATE
TO authenticated
USING (
  (cashier_id = auth.uid() AND status = 'pending') OR 
  public.has_role(auth.uid(), 'admin')
);

-- =============================================
-- TIME_TRACKING TABLE - Own records only for employees
-- =============================================
DROP POLICY IF EXISTS "Employees can view their own time tracking" ON public.time_tracking;
DROP POLICY IF EXISTS "Employees can insert their own time tracking" ON public.time_tracking;
DROP POLICY IF EXISTS "Employees can update their own time tracking" ON public.time_tracking;
DROP POLICY IF EXISTS "Admins can view all time tracking" ON public.time_tracking;
DROP POLICY IF EXISTS "Staff can view time tracking" ON public.time_tracking;
DROP POLICY IF EXISTS "Staff can manage time tracking" ON public.time_tracking;

CREATE POLICY "Employees view own time tracking only"
ON public.time_tracking FOR SELECT
TO authenticated
USING (
  employee_id = auth.uid() OR 
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Employees insert own time tracking only"
ON public.time_tracking FOR INSERT
TO authenticated
WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Employees update own time tracking only"
ON public.time_tracking FOR UPDATE
TO authenticated
USING (
  employee_id = auth.uid() OR 
  public.has_role(auth.uid(), 'admin')
);

-- =============================================
-- SALES TABLE - Own records only for cashiers
-- =============================================
DROP POLICY IF EXISTS "Cashiers can view their own sales" ON public.sales;
DROP POLICY IF EXISTS "Cashiers can insert sales" ON public.sales;
DROP POLICY IF EXISTS "Admins can view all sales" ON public.sales;
DROP POLICY IF EXISTS "Staff can view sales" ON public.sales;
DROP POLICY IF EXISTS "Staff can manage sales" ON public.sales;

CREATE POLICY "Cashiers view own sales only"
ON public.sales FOR SELECT
TO authenticated
USING (
  cashier_id = auth.uid() OR 
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Cashiers insert own sales only"
ON public.sales FOR INSERT
TO authenticated
WITH CHECK (cashier_id = auth.uid());

-- =============================================
-- DELIVERY_ASSIGNMENTS TABLE - Restrict access
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view delivery assignments" ON public.delivery_assignments;
DROP POLICY IF EXISTS "Authenticated users can insert delivery assignments" ON public.delivery_assignments;
DROP POLICY IF EXISTS "Authenticated users can update delivery assignments" ON public.delivery_assignments;
DROP POLICY IF EXISTS "Staff can view delivery assignments" ON public.delivery_assignments;
DROP POLICY IF EXISTS "Staff can manage delivery assignments" ON public.delivery_assignments;

CREATE POLICY "Admins can view all delivery assignments"
ON public.delivery_assignments FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert delivery assignments"
ON public.delivery_assignments FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update delivery assignments"
ON public.delivery_assignments FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- PRINTER_LOGS TABLE - Restrict to admin only for viewing
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view printer logs" ON public.printer_logs;
DROP POLICY IF EXISTS "Authenticated users can insert printer logs" ON public.printer_logs;
DROP POLICY IF EXISTS "Staff can view printer logs" ON public.printer_logs;
DROP POLICY IF EXISTS "Staff can insert printer logs" ON public.printer_logs;

CREATE POLICY "Only admins can view printer logs"
ON public.printer_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can insert printer logs"
ON public.printer_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- =============================================
-- PROFILES TABLE - Exclude pin_hash from non-admin queries
-- Create a view that excludes sensitive data
-- =============================================
CREATE OR REPLACE VIEW public.profiles_safe AS
SELECT id, full_name, role, created_at, updated_at
FROM public.profiles;

-- Grant access to the safe view
GRANT SELECT ON public.profiles_safe TO authenticated;