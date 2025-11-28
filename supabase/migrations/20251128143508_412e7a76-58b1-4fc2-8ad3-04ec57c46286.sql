-- Phase 1: Restaurant POS Complete Database Schema
-- Security: Proper roles table + Restaurant features

-- 1. Create proper role system (security requirement)
CREATE TYPE public.app_role AS ENUM ('admin', 'cashier', 'waiter', 'kitchen');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Migrate existing roles from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, role::text::app_role FROM public.profiles
ON CONFLICT (user_id, role) DO NOTHING;

-- RLS for user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Update profiles RLS to use has_role
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- 2. Floor Plans
CREATE TABLE public.floor_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.floor_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active floor plans" ON public.floor_plans
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage floor plans" ON public.floor_plans
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 3. Tables (Restaurant Tables)
CREATE TABLE public.restaurant_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_plan_id UUID REFERENCES public.floor_plans(id) ON DELETE CASCADE,
  table_number TEXT NOT NULL,
  seats INTEGER NOT NULL DEFAULT 4,
  position_x NUMERIC,
  position_y NUMERIC,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'cleaning')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (floor_plan_id, table_number)
);

ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active tables" ON public.restaurant_tables
  FOR SELECT USING (is_active = true);

CREATE POLICY "Staff can update table status" ON public.restaurant_tables
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'waiter') OR 
    public.has_role(auth.uid(), 'cashier')
  );

CREATE POLICY "Admins can manage tables" ON public.restaurant_tables
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 4. Orders (with state machine)
CREATE TYPE public.order_status AS ENUM (
  'pending', 'confirmed', 'preparing', 'ready', 'served', 'paid', 'cancelled'
);

CREATE TYPE public.order_type AS ENUM ('dine_in', 'takeout', 'delivery');

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  table_id UUID REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
  order_type order_type NOT NULL DEFAULT 'dine_in',
  status order_status NOT NULL DEFAULT 'pending',
  waiter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name TEXT,
  guest_count INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all orders" ON public.orders
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'cashier') OR 
    public.has_role(auth.uid(), 'waiter') OR 
    public.has_role(auth.uid(), 'kitchen')
  );

CREATE POLICY "Waiters can create orders" ON public.orders
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'waiter') OR 
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Staff can update orders" ON public.orders
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'waiter') OR 
    public.has_role(auth.uid(), 'kitchen')
  );

-- 5. Order Items (with kitchen routing)
CREATE TYPE public.kitchen_station AS ENUM ('grill', 'fryer', 'salad', 'dessert', 'bar', 'general');

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT NOT NULL,
  product_name TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  qty INTEGER NOT NULL,
  price_at_order NUMERIC NOT NULL,
  cost_at_order NUMERIC NOT NULL,
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  line_total NUMERIC NOT NULL,
  kitchen_station kitchen_station NOT NULL DEFAULT 'general',
  status order_status NOT NULL DEFAULT 'pending',
  special_instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view order items" ON public.order_items
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'cashier') OR 
    public.has_role(auth.uid(), 'waiter') OR 
    public.has_role(auth.uid(), 'kitchen')
  );

CREATE POLICY "Staff can manage order items" ON public.order_items
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'waiter')
  );

CREATE POLICY "Kitchen can update item status" ON public.order_items
  FOR UPDATE USING (public.has_role(auth.uid(), 'kitchen'));

-- 6. Payments (for split payments)
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  tip_amount NUMERIC NOT NULL DEFAULT 0,
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view payments" ON public.payments
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'cashier')
  );

CREATE POLICY "Cashiers can create payments" ON public.payments
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'cashier') OR 
    public.has_role(auth.uid(), 'admin')
  );

-- 7. Add kitchen_station to products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS kitchen_station kitchen_station DEFAULT 'general';

-- 8. Triggers for updated_at
CREATE TRIGGER update_floor_plans_updated_at
  BEFORE UPDATE ON public.floor_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_restaurant_tables_updated_at
  BEFORE UPDATE ON public.restaurant_tables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_order_items_updated_at
  BEFORE UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Function to generate order numbers
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE PLPGSQL
AS $$
DECLARE
  new_number TEXT;
BEGIN
  new_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN new_number;
END;
$$;

-- 10. Enable realtime for orders and order_items
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_tables;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;