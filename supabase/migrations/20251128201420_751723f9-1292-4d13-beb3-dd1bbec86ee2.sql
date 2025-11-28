-- Create customers table for delivery orders
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create delivery_addresses table
CREATE TABLE public.delivery_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  notes TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create delivery_assignments table
CREATE TABLE public.delivery_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES auth.users(id),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  delivery_address_id UUID NOT NULL REFERENCES public.delivery_addresses(id),
  pickup_time TIMESTAMP WITH TIME ZONE,
  delivery_time TIMESTAMP WITH TIME ZONE,
  estimated_delivery TIMESTAMP WITH TIME ZONE,
  delivery_fee NUMERIC NOT NULL DEFAULT 0,
  delivery_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customers
CREATE POLICY "Staff can view all customers"
  ON public.customers FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'cashier'::app_role) OR 
    has_role(auth.uid(), 'waiter'::app_role)
  );

CREATE POLICY "Staff can create customers"
  ON public.customers FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'cashier'::app_role) OR 
    has_role(auth.uid(), 'waiter'::app_role)
  );

CREATE POLICY "Staff can update customers"
  ON public.customers FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'cashier'::app_role) OR 
    has_role(auth.uid(), 'waiter'::app_role)
  );

-- RLS Policies for delivery_addresses
CREATE POLICY "Staff can view delivery addresses"
  ON public.delivery_addresses FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'cashier'::app_role) OR 
    has_role(auth.uid(), 'waiter'::app_role)
  );

CREATE POLICY "Staff can manage delivery addresses"
  ON public.delivery_addresses FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'cashier'::app_role) OR 
    has_role(auth.uid(), 'waiter'::app_role)
  );

-- RLS Policies for delivery_assignments
CREATE POLICY "Staff can view delivery assignments"
  ON public.delivery_assignments FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'cashier'::app_role) OR 
    has_role(auth.uid(), 'waiter'::app_role)
  );

CREATE POLICY "Staff can manage delivery assignments"
  ON public.delivery_assignments FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'waiter'::app_role)
  );

-- Triggers for updated_at
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_delivery_addresses_updated_at
  BEFORE UPDATE ON public.delivery_addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_delivery_assignments_updated_at
  BEFORE UPDATE ON public.delivery_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_customers_phone ON public.customers(phone);
CREATE INDEX idx_delivery_assignments_order ON public.delivery_assignments(order_id);
CREATE INDEX idx_delivery_assignments_driver ON public.delivery_assignments(driver_id);
CREATE INDEX idx_delivery_assignments_status ON public.delivery_assignments(status);