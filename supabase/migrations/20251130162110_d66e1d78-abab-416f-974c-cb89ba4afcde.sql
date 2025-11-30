-- Create EOD sessions table
CREATE TABLE public.eod_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cashier_id UUID NOT NULL REFERENCES public.profiles(id),
  shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  
  -- Cash reconciliation
  expected_cash NUMERIC NOT NULL DEFAULT 0,
  actual_cash NUMERIC,
  cash_difference NUMERIC GENERATED ALWAYS AS (actual_cash - expected_cash) STORED,
  
  -- Summary data
  total_sales NUMERIC NOT NULL DEFAULT 0,
  total_transactions INTEGER NOT NULL DEFAULT 0,
  
  -- Notes
  cashier_notes TEXT,
  admin_notes TEXT,
  
  -- Timestamps
  submitted_at TIMESTAMP WITH TIME ZONE,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES public.profiles(id),
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.eod_sessions ENABLE ROW LEVEL SECURITY;

-- Cashiers can view their own EOD sessions
CREATE POLICY "Cashiers can view own EOD sessions"
ON public.eod_sessions
FOR SELECT
USING (
  cashier_id = auth.uid() OR
  has_role(auth.uid(), 'admin'::app_role)
);

-- Cashiers can create their own EOD sessions
CREATE POLICY "Cashiers can create EOD sessions"
ON public.eod_sessions
FOR INSERT
WITH CHECK (
  cashier_id = auth.uid() AND
  (has_role(auth.uid(), 'cashier'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

-- Cashiers can update their pending EOD sessions
CREATE POLICY "Cashiers can update pending EOD"
ON public.eod_sessions
FOR UPDATE
USING (
  cashier_id = auth.uid() AND 
  status = 'pending'
);

-- Admins can update any EOD session
CREATE POLICY "Admins can manage EOD sessions"
ON public.eod_sessions
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_eod_sessions_updated_at
BEFORE UPDATE ON public.eod_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for performance
CREATE INDEX idx_eod_sessions_cashier_date ON public.eod_sessions(cashier_id, shift_date);
CREATE INDEX idx_eod_sessions_status ON public.eod_sessions(status);