-- Fix search_path security warning for the timing function
CREATE OR REPLACE FUNCTION set_order_item_started_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'preparing' AND OLD.status = 'pending' AND NEW.started_at IS NULL THEN
    NEW.started_at = NOW();
  END IF;
  IF NEW.status = 'ready' AND OLD.status = 'preparing' AND NEW.completed_at IS NULL THEN
    NEW.completed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;