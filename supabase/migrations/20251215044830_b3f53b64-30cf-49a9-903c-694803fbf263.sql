-- Step 1: Deactivate products in retail categories (can't delete due to order history)
UPDATE products SET is_active = false WHERE category_id IN (
  SELECT id FROM categories WHERE name IN ('Clothing', 'Electronics', 'Groceries', 'Home & Garden')
);

-- Step 2: Deactivate products in placeholder food categories
UPDATE products SET is_active = false WHERE category_id IN (
  SELECT id FROM categories WHERE name IN ('Appetizers', 'Curry & Bunny', 'Main Course')
);

-- Step 3: Deactivate duplicate Grill & Platters category products
UPDATE products SET is_active = false WHERE category_id IN (
  SELECT id FROM categories WHERE name = 'Grill & Platters'
);

-- Step 4: Deactivate generic/duplicate products
UPDATE products SET is_active = false WHERE name IN (
  'Loaded Fries (Medium)',
  'Loaded Fries (Large)',
  '200g Beef Burger and Chips'
);

-- Step 5: Deactivate Drinks category items (duplicated in Assorted Drinks)
UPDATE products SET is_active = false WHERE category_id IN (
  SELECT id FROM categories WHERE name = 'Drinks'
);

-- Step 6: Deactivate generic Beverages items
UPDATE products SET is_active = false WHERE category_id IN (
  SELECT id FROM categories WHERE name = 'Beverages'
) AND name IN ('Gin', 'Cola');

-- Step 7: Delete categories that have no active products or are retail
DELETE FROM categories WHERE name IN ('Clothing', 'Electronics', 'Groceries', 'Home & Garden', 'Appetizers', 'Curry & Bunny', 'Main Course', 'Grill & Platters', 'Drinks')
AND NOT EXISTS (
  SELECT 1 FROM products WHERE products.category_id = categories.id AND products.is_active = true
);

-- Step 8: Delete Beverages if empty
DELETE FROM categories WHERE name = 'Beverages' AND NOT EXISTS (
  SELECT 1 FROM products WHERE products.category_id = categories.id AND products.is_active = true
);