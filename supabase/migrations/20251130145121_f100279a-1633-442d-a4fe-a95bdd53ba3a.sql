-- Fix search_path for set_order_item_started_at function
CREATE OR REPLACE FUNCTION public.set_order_item_started_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF NEW.status = 'preparing' AND OLD.status = 'pending' AND NEW.started_at IS NULL THEN
    NEW.started_at = NOW();
  END IF;
  IF NEW.status = 'ready' AND OLD.status = 'preparing' AND NEW.completed_at IS NULL THEN
    NEW.completed_at = NOW();
  END IF;
  RETURN NEW;
END;
$function$;