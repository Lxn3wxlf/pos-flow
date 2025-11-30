-- Create shifts table for employee scheduling
CREATE TABLE public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  role app_role NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create time_tracking table for clock-in/out
CREATE TABLE public.time_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  break_start TIMESTAMPTZ,
  break_end TIMESTAMPTZ,
  total_hours NUMERIC,
  hourly_rate NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create reservations table
CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  guest_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  special_requests TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create waitlist table
CREATE TABLE public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  guest_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  estimated_wait_time INTEGER,
  notified_at TIMESTAMPTZ,
  seated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shifts
CREATE POLICY "Staff can view shifts" ON public.shifts FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'waiter'::app_role) OR 
  employee_id = auth.uid()
);

CREATE POLICY "Admins can manage shifts" ON public.shifts FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role)
);

-- RLS Policies for time_tracking
CREATE POLICY "Employees can view own time" ON public.time_tracking FOR SELECT USING (
  employee_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Employees can clock in/out" ON public.time_tracking FOR INSERT WITH CHECK (
  employee_id = auth.uid()
);

CREATE POLICY "Employees can update own time" ON public.time_tracking FOR UPDATE USING (
  employee_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can manage all time tracking" ON public.time_tracking FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role)
);

-- RLS Policies for reservations
CREATE POLICY "Staff can view reservations" ON public.reservations FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'waiter'::app_role) OR
  has_role(auth.uid(), 'cashier'::app_role)
);

CREATE POLICY "Staff can manage reservations" ON public.reservations FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'waiter'::app_role)
);

-- RLS Policies for waitlist
CREATE POLICY "Staff can view waitlist" ON public.waitlist FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'waiter'::app_role) OR
  has_role(auth.uid(), 'cashier'::app_role)
);

CREATE POLICY "Staff can manage waitlist" ON public.waitlist FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'waiter'::app_role)
);

-- Create triggers for updated_at
CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON public.shifts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_waitlist_updated_at BEFORE UPDATE ON public.waitlist
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to calculate time tracking totals
CREATE OR REPLACE FUNCTION calculate_time_tracking_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.clock_out IS NOT NULL THEN
    NEW.total_hours := EXTRACT(EPOCH FROM (NEW.clock_out - NEW.clock_in)) / 3600;
    
    -- Subtract break time if exists
    IF NEW.break_start IS NOT NULL AND NEW.break_end IS NOT NULL THEN
      NEW.total_hours := NEW.total_hours - (EXTRACT(EPOCH FROM (NEW.break_end - NEW.break_start)) / 3600);
    END IF;
    
    NEW.total_cost := NEW.total_hours * NEW.hourly_rate;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_time_tracking BEFORE INSERT OR UPDATE ON public.time_tracking
FOR EACH ROW EXECUTE FUNCTION calculate_time_tracking_totals();

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.waitlist;