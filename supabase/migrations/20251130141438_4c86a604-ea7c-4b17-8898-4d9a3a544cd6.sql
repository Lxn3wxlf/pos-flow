-- Add prep time tracking to products and order items
ALTER TABLE products 
ADD COLUMN estimated_prep_minutes INTEGER DEFAULT 10;

COMMENT ON COLUMN products.estimated_prep_minutes IS 'Estimated preparation time in minutes';

-- Add timing columns to order_items
ALTER TABLE order_items 
ADD COLUMN started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN order_items.started_at IS 'When the item started being prepared';
COMMENT ON COLUMN order_items.completed_at IS 'When the item was marked as ready';

-- Create function to auto-set started_at when status changes to preparing
CREATE OR REPLACE FUNCTION set_order_item_started_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'preparing' AND OLD.status = 'pending' AND NEW.started_at IS NULL THEN
    NEW.started_at = NOW();
  END IF;
  IF NEW.status = 'ready' AND OLD.status = 'preparing' AND NEW.completed_at IS NULL THEN
    NEW.completed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS order_item_timing_trigger ON order_items;
CREATE TRIGGER order_item_timing_trigger
  BEFORE UPDATE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION set_order_item_started_at();