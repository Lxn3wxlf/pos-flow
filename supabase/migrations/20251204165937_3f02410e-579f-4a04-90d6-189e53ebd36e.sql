-- Create printer_logs table for error tracking
CREATE TABLE IF NOT EXISTS public.printer_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  printer_name TEXT NOT NULL,
  printer_ip TEXT,
  order_id TEXT,
  print_type TEXT NOT NULL, -- 'receipt' or 'kitchen'
  status TEXT NOT NULL, -- 'success', 'failed', 'pending'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.printer_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert logs
CREATE POLICY "Authenticated users can insert printer logs"
ON public.printer_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to read logs
CREATE POLICY "Authenticated users can read printer logs"
ON public.printer_logs
FOR SELECT
TO authenticated
USING (true);

-- Add port column to printer_settings if not exists
ALTER TABLE public.printer_settings 
ADD COLUMN IF NOT EXISTS port INTEGER DEFAULT 9100;