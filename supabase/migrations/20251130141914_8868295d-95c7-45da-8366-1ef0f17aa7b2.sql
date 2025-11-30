-- Add weight-based pricing support to products
ALTER TABLE products 
ADD COLUMN pricing_type VARCHAR(20) DEFAULT 'fixed' CHECK (pricing_type IN ('fixed', 'weight')),
ADD COLUMN price_per_unit NUMERIC(10, 2),
ADD COLUMN unit_type VARCHAR(20) DEFAULT 'gram' CHECK (unit_type IN ('gram', 'kg', 'ml', 'liter'));

COMMENT ON COLUMN products.pricing_type IS 'Either fixed price or weight-based pricing';
COMMENT ON COLUMN products.price_per_unit IS 'Price per gram/kg for weight-based items';
COMMENT ON COLUMN products.unit_type IS 'Unit of measurement for weight-based items';

-- Add weight to order_items for weight-based products
ALTER TABLE order_items
ADD COLUMN weight_amount NUMERIC(10, 2),
ADD COLUMN weight_unit VARCHAR(20);

COMMENT ON COLUMN order_items.weight_amount IS 'Amount of weight ordered (e.g., 300, 500, 1000)';
COMMENT ON COLUMN order_items.weight_unit IS 'Unit of weight (gram, kg)';

-- Create table for payment transactions
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  payment_provider VARCHAR(50) NOT NULL,
  provider_transaction_id TEXT,
  amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'ZAR',
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded')),
  payment_method VARCHAR(50),
  card_last_four VARCHAR(4),
  card_brand VARCHAR(20),
  metadata JSONB,
  error_message TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE payment_transactions IS 'Tracks all payment transactions from various providers like Yoco';

-- Create index for faster lookups
CREATE INDEX idx_payment_transactions_order_id ON payment_transactions(order_id);
CREATE INDEX idx_payment_transactions_sale_id ON payment_transactions(sale_id);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);

-- Enable RLS
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for payment_transactions
CREATE POLICY "Staff can view payment transactions"
  ON payment_transactions FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'cashier'));

CREATE POLICY "Staff can create payment transactions"
  ON payment_transactions FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'cashier'));

-- Trigger for updated_at
CREATE TRIGGER update_payment_transactions_updated_at
  BEFORE UPDATE ON payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();