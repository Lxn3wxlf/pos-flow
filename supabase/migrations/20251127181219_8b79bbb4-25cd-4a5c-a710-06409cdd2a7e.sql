-- Create user roles enum
CREATE TYPE user_role AS ENUM ('admin', 'cashier');

-- Create profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'cashier',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Categories RLS policies
CREATE POLICY "Anyone can view categories"
  ON categories FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage categories"
  ON categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT UNIQUE NOT NULL,
  barcode TEXT,
  description TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  price DECIMAL(12,2) NOT NULL CHECK (price >= 0),
  cost DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
  stock_qty INTEGER NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on barcode for fast lookups
CREATE INDEX idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category_id);

-- Enable RLS on products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Products RLS policies
CREATE POLICY "Anyone can view active products"
  ON products FOR SELECT
  USING (is_active = true OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Only admins can manage products"
  ON products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create sales table
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id UUID NOT NULL REFERENCES profiles(id),
  subtotal DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0),
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  total DECIMAL(12,2) NOT NULL CHECK (total >= 0),
  payment_method TEXT NOT NULL,
  notes TEXT,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_sales_cashier ON sales(cashier_id);
CREATE INDEX idx_sales_created_at ON sales(created_at DESC);

-- Enable RLS on sales
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- Sales RLS policies
CREATE POLICY "Cashiers can view their own sales"
  ON sales FOR SELECT
  USING (
    cashier_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Cashiers can create sales"
  ON sales FOR INSERT
  WITH CHECK (cashier_id = auth.uid());

CREATE POLICY "Admins can manage all sales"
  ON sales FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create sale_items table
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  price_at_sale DECIMAL(12,2) NOT NULL CHECK (price_at_sale >= 0),
  cost_at_sale DECIMAL(12,2) NOT NULL CHECK (cost_at_sale >= 0),
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(12,2) NOT NULL CHECK (line_total >= 0)
);

-- Create index for faster queries
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);

-- Enable RLS on sale_items
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- Sale items RLS policies
CREATE POLICY "Users can view sale items for their accessible sales"
  ON sale_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sales
      WHERE sales.id = sale_items.sale_id
      AND (
        sales.cashier_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      )
    )
  );

CREATE POLICY "Users can create sale items for their sales"
  ON sale_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales
      WHERE sales.id = sale_items.sale_id
      AND sales.cashier_id = auth.uid()
    )
  );

-- Create inventory_adjustments table
CREATE TABLE inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  delta_qty INTEGER NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_inventory_adjustments_product ON inventory_adjustments(product_id);
CREATE INDEX idx_inventory_adjustments_created_at ON inventory_adjustments(created_at DESC);

-- Enable RLS on inventory_adjustments
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;

-- Inventory adjustments RLS policies
CREATE POLICY "Anyone can view adjustments"
  ON inventory_adjustments FOR SELECT
  USING (true);

CREATE POLICY "Only admins can create adjustments"
  ON inventory_adjustments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'cashier')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Insert sample categories
INSERT INTO categories (name, description) VALUES
  ('Electronics', 'Electronic devices and accessories'),
  ('Groceries', 'Food and beverages'),
  ('Clothing', 'Apparel and fashion items'),
  ('Home & Garden', 'Home improvement and gardening supplies');

-- Insert sample products
INSERT INTO products (name, sku, barcode, description, category_id, price, cost, tax_rate, stock_qty) VALUES
  ('Wireless Mouse', 'ELEC-001', '1234567890123', 'Ergonomic wireless mouse with USB receiver', 
   (SELECT id FROM categories WHERE name = 'Electronics'), 29.99, 15.00, 13, 50),
  ('USB-C Cable', 'ELEC-002', '1234567890124', '2m USB-C charging cable',
   (SELECT id FROM categories WHERE name = 'Electronics'), 12.99, 6.00, 13, 100),
  ('Coffee Beans 500g', 'GROC-001', '2234567890123', 'Premium Arabica coffee beans',
   (SELECT id FROM categories WHERE name = 'Groceries'), 18.50, 9.00, 13, 75),
  ('Organic Milk 1L', 'GROC-002', '2234567890124', 'Fresh organic whole milk',
   (SELECT id FROM categories WHERE name = 'Groceries'), 4.99, 2.50, 13, 120),
  ('Cotton T-Shirt', 'CLTH-001', '3234567890123', '100% cotton crew neck t-shirt',
   (SELECT id FROM categories WHERE name = 'Clothing'), 24.99, 12.00, 13, 80);