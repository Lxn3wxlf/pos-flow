-- Create bar_tabs table for managing open tabs
CREATE TABLE public.bar_tabs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  table_id UUID REFERENCES public.restaurant_tables(id),
  spending_limit NUMERIC NOT NULL CHECK (spending_limit > 0),
  current_total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled', 'cancelled')),
  opened_by UUID NOT NULL,
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  closed_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bar_tab_items table for items added to tabs
CREATE TABLE public.bar_tab_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tab_id UUID NOT NULL REFERENCES public.bar_tabs(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  line_total NUMERIC NOT NULL,
  added_by UUID NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.bar_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_tab_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bar_tabs
CREATE POLICY "Staff can view bar tabs"
ON public.bar_tabs FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cashier'::app_role) OR has_role(auth.uid(), 'waiter'::app_role));

CREATE POLICY "Staff can create bar tabs"
ON public.bar_tabs FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cashier'::app_role) OR has_role(auth.uid(), 'waiter'::app_role));

CREATE POLICY "Staff can update bar tabs"
ON public.bar_tabs FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cashier'::app_role) OR has_role(auth.uid(), 'waiter'::app_role));

-- RLS Policies for bar_tab_items
CREATE POLICY "Staff can view tab items"
ON public.bar_tab_items FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cashier'::app_role) OR has_role(auth.uid(), 'waiter'::app_role));

CREATE POLICY "Staff can add tab items"
ON public.bar_tab_items FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cashier'::app_role) OR has_role(auth.uid(), 'waiter'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_bar_tabs_updated_at
BEFORE UPDATE ON public.bar_tabs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for bar_tabs
ALTER PUBLICATION supabase_realtime ADD TABLE public.bar_tabs;