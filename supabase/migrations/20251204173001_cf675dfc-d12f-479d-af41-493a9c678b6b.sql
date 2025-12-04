-- Create qz_printers table for QZ Tray printer configuration
CREATE TABLE public.qz_printers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL UNIQUE CHECK (label IN ('cashier', 'kitchen')),
  printer_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.qz_printers ENABLE ROW LEVEL SECURITY;

-- Admins can manage QZ printers
CREATE POLICY "Admins can manage QZ printers"
ON public.qz_printers
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Staff can view QZ printers
CREATE POLICY "Staff can view QZ printers"
ON public.qz_printers
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'cashier'::app_role) OR 
  has_role(auth.uid(), 'waiter'::app_role)
);

-- Add updated_at trigger
CREATE TRIGGER update_qz_printers_updated_at
BEFORE UPDATE ON public.qz_printers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();