-- Create table for printer configurations
CREATE TABLE public.printer_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  ip_address text NOT NULL,
  printer_type text NOT NULL CHECK (printer_type IN ('kitchen', 'receipt', 'bar')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create table for print routing rules
CREATE TABLE public.print_routing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name text NOT NULL,
  printer_id uuid REFERENCES public.printer_settings(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create table for receipt branding
CREATE TABLE public.receipt_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_url text,
  business_name text,
  address_line1 text,
  address_line2 text,
  phone text,
  footer_text text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.printer_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_branding ENABLE ROW LEVEL SECURITY;

-- RLS policies - Admin only
CREATE POLICY "Admins can manage printer settings"
ON public.printer_settings FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage print routing rules"
ON public.print_routing_rules FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage receipt branding"
ON public.receipt_branding FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow staff to read printer settings for printing
CREATE POLICY "Staff can view printer settings"
ON public.printer_settings FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cashier'::app_role) OR has_role(auth.uid(), 'waiter'::app_role));

CREATE POLICY "Staff can view print routing rules"
ON public.print_routing_rules FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cashier'::app_role) OR has_role(auth.uid(), 'waiter'::app_role));

CREATE POLICY "Staff can view receipt branding"
ON public.receipt_branding FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cashier'::app_role) OR has_role(auth.uid(), 'waiter'::app_role));

-- Update trigger for timestamps
CREATE TRIGGER update_printer_settings_updated_at
BEFORE UPDATE ON public.printer_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_receipt_branding_updated_at
BEFORE UPDATE ON public.receipt_branding
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();