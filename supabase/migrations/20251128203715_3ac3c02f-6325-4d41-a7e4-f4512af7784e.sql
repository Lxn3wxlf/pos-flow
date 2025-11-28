-- ============================================
-- PRODUCT MODIFIERS SYSTEM
-- ============================================

-- Modifier groups (e.g., "Toppings", "Size", "Extras")
CREATE TABLE public.modifier_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  selection_type TEXT NOT NULL CHECK (selection_type IN ('single', 'multiple')),
  min_selections INTEGER NOT NULL DEFAULT 0,
  max_selections INTEGER,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Individual modifiers (e.g., "Extra Cheese +R5", "Large +R10")
CREATE TABLE public.modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modifier_group_id UUID NOT NULL REFERENCES public.modifier_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_adjustment NUMERIC NOT NULL DEFAULT 0,
  is_available BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Link modifiers to products
CREATE TABLE public.product_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  modifier_group_id UUID NOT NULL REFERENCES public.modifier_groups(id) ON DELETE CASCADE,
  is_required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, modifier_group_id)
);

-- Store selected modifiers on order items
CREATE TABLE public.order_item_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  modifier_id UUID NOT NULL REFERENCES public.modifiers(id),
  modifier_name TEXT NOT NULL,
  price_adjustment NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- COMBOS & MEAL DEALS SYSTEM
-- ============================================

-- Mark products as combos
CREATE TABLE public.combo_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
  combo_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Define what's included in a combo (e.g., "1 Burger + 1 Drink")
CREATE TABLE public.combo_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_product_id UUID NOT NULL REFERENCES public.combo_products(id) ON DELETE CASCADE,
  component_name TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id),
  qty INTEGER NOT NULL DEFAULT 1,
  allows_substitution BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Store actual combo selections on order items
CREATE TABLE public.order_item_combo_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  combo_component_id UUID NOT NULL REFERENCES public.combo_components(id),
  selected_product_id UUID NOT NULL REFERENCES public.products(id),
  selected_product_name TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_modifiers_group ON public.modifiers(modifier_group_id);
CREATE INDEX idx_product_modifiers_product ON public.product_modifiers(product_id);
CREATE INDEX idx_order_item_modifiers_item ON public.order_item_modifiers(order_item_id);
CREATE INDEX idx_combo_components_combo ON public.combo_components(combo_product_id);
CREATE INDEX idx_order_combo_selections_item ON public.order_item_combo_selections(order_item_id);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Modifier Groups
ALTER TABLE public.modifier_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active modifier groups"
ON public.modifier_groups FOR SELECT
USING (is_active = true OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage modifier groups"
ON public.modifier_groups FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Modifiers
ALTER TABLE public.modifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view available modifiers"
ON public.modifiers FOR SELECT
USING (is_available = true OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage modifiers"
ON public.modifiers FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Product Modifiers
ALTER TABLE public.product_modifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view product modifiers"
ON public.product_modifiers FOR SELECT
USING (true);

CREATE POLICY "Admins can manage product modifiers"
ON public.product_modifiers FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Order Item Modifiers
ALTER TABLE public.order_item_modifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view order item modifiers"
ON public.order_item_modifiers FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'waiter') OR has_role(auth.uid(), 'kitchen') OR has_role(auth.uid(), 'cashier'));

CREATE POLICY "Staff can create order item modifiers"
ON public.order_item_modifiers FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'waiter') OR has_role(auth.uid(), 'cashier'));

-- Combo Products
ALTER TABLE public.combo_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view combo products"
ON public.combo_products FOR SELECT
USING (true);

CREATE POLICY "Admins can manage combo products"
ON public.combo_products FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Combo Components
ALTER TABLE public.combo_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view combo components"
ON public.combo_components FOR SELECT
USING (true);

CREATE POLICY "Admins can manage combo components"
ON public.combo_components FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Order Item Combo Selections
ALTER TABLE public.order_item_combo_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view combo selections"
ON public.order_item_combo_selections FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'waiter') OR has_role(auth.uid(), 'kitchen') OR has_role(auth.uid(), 'cashier'));

CREATE POLICY "Staff can create combo selections"
ON public.order_item_combo_selections FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'waiter') OR has_role(auth.uid(), 'cashier'));

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE TRIGGER update_modifier_groups_updated_at
BEFORE UPDATE ON public.modifier_groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_modifiers_updated_at
BEFORE UPDATE ON public.modifiers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_combo_products_updated_at
BEFORE UPDATE ON public.combo_products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();