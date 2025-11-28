import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Navigate, useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Minus, Trash2, Send, Search, Settings } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import ModifierSelector, { SelectedModifier } from '@/components/ModifierSelector';
import ComboSelector, { ComboSelection } from '@/components/ComboSelector';

interface Product {
  id: string;
  name: string;
  price: number;
  cost: number;
  tax_rate: number;
  kitchen_station?: string;
}

interface OrderItem {
  id?: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  qty: number;
  price_at_order: number;
  cost_at_order: number;
  tax_rate: number;
  line_total: number;
  special_instructions?: string;
  kitchen_station: string;
  modifiers?: SelectedModifier[];
  combo_selections?: ComboSelection[];
  price_adjustment: number;
}

interface Order {
  id: string;
  order_number: string;
  table_id: string;
  status: string;
  customer_name?: string;
  guest_count?: number;
  notes?: string;
  restaurant_tables?: {
    table_number: string;
  };
}

const WaiterOrder = () => {
  const { user, profile } = useAuth();
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [modifierDialogOpen, setModifierDialogOpen] = useState(false);
  const [comboDialogOpen, setComboDialogOpen] = useState(false);
  const [selectedProductForCustomization, setSelectedProductForCustomization] = useState<Product | null>(null);
  const [hasModifiers, setHasModifiers] = useState<Set<string>>(new Set());
  const [hasCombos, setHasCombos] = useState<Set<string>>(new Set());

  if (!user) return <Navigate to="/auth" />;
  const hasAccess = profile?.roles?.some(r => ['waiter', 'admin'].includes(r));
  if (!hasAccess) return <Navigate to="/pos" />;

  useEffect(() => {
    loadOrder();
    loadProducts();
    loadProductFeatures();
  }, [orderId]);

  const loadProductFeatures = async () => {
    try {
      const [modifiersRes, combosRes] = await Promise.all([
        supabase.from('product_modifiers').select('product_id'),
        supabase.from('combo_products').select('product_id'),
      ]);

      if (!modifiersRes.error) {
        setHasModifiers(new Set(modifiersRes.data?.map(pm => pm.product_id) || []));
      }
      if (!combosRes.error) {
        setHasCombos(new Set(combosRes.data?.map(cp => cp.product_id) || []));
      }
    } catch (error) {
      console.error('Error loading product features:', error);
    }
  };

  const loadOrder = async () => {
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*, restaurant_tables(table_number)')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;
      setOrder(orderData);

      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

      if (itemsError) throw itemsError;
      
      const itemsWithExtras = await Promise.all(
        (itemsData || []).map(async (item) => {
          const [modifiersRes, comboRes] = await Promise.all([
            supabase.from('order_item_modifiers').select('*').eq('order_item_id', item.id),
            supabase.from('order_item_combo_selections').select('*').eq('order_item_id', item.id),
          ]);

          const modifiers = modifiersRes.data || [];
          const combo_selections = comboRes.data || [];
          const price_adjustment = modifiers.reduce((sum, m) => sum + Number(m.price_adjustment), 0);

          return {
            ...item,
            modifiers,
            combo_selections,
            price_adjustment,
          };
        })
      );
      
      setOrderItems(itemsWithExtras);
    } catch (error) {
      console.error('Error loading order:', error);
      toast.error('Failed to load order');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const openCustomization = (product: Product) => {
    setSelectedProductForCustomization(product);
    
    if (hasCombos.has(product.id)) {
      setComboDialogOpen(true);
    } else if (hasModifiers.has(product.id)) {
      setModifierDialogOpen(true);
    } else {
      addItemDirectly(product);
    }
  };

  const addItemDirectly = (product: Product, modifiers?: SelectedModifier[], comboSelections?: ComboSelection[]) => {
    const priceAdjustment = modifiers?.reduce((sum, m) => sum + m.price_adjustment, 0) || 0;
    const finalPrice = product.price + priceAdjustment;

    const newItem: OrderItem = {
      product_id: product.id,
      product_name: product.name,
      product_sku: product.id,
      qty: 1,
      price_at_order: finalPrice,
      cost_at_order: product.cost,
      tax_rate: product.tax_rate,
      line_total: finalPrice,
      kitchen_station: product.kitchen_station || 'general',
      modifiers: modifiers || [],
      combo_selections: comboSelections || [],
      price_adjustment: priceAdjustment,
    };
    
    setOrderItems([...orderItems, newItem]);
    toast.success(`Added ${product.name}`);
  };

  const handleModifierConfirm = (modifiers: SelectedModifier[], totalAdjustment: number) => {
    if (selectedProductForCustomization) {
      addItemDirectly(selectedProductForCustomization, modifiers);
    }
    setSelectedProductForCustomization(null);
  };

  const handleComboConfirm = (selections: ComboSelection[]) => {
    if (selectedProductForCustomization) {
      addItemDirectly(selectedProductForCustomization, [], selections);
    }
    setSelectedProductForCustomization(null);
  };

  const updateItemQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      removeItem(index);
      return;
    }
    setOrderItems(orderItems.map((item, i) => 
      i === index 
        ? { ...item, qty: newQty, line_total: item.price_at_order * newQty }
        : item
    ));
  };

  const removeItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const updateItemInstructions = (index: number, instructions: string) => {
    setOrderItems(orderItems.map((item, i) =>
      i === index ? { ...item, special_instructions: instructions } : item
    ));
  };

  const submitOrder = async () => {
    if (orderItems.length === 0) {
      toast.error('Please add items to the order');
      return;
    }

    try {
      // Insert order items
      const insertedItems = await Promise.all(
        orderItems.map(async (item) => {
          const { data: insertedItem, error: itemError } = await supabase
            .from('order_items')
            .insert([{
              order_id: orderId,
              product_id: item.product_id,
              product_name: item.product_name,
              product_sku: item.product_sku,
              qty: item.qty,
              price_at_order: item.price_at_order,
              cost_at_order: item.cost_at_order,
              tax_rate: item.tax_rate,
              line_total: item.line_total,
              special_instructions: item.special_instructions || null,
              kitchen_station: item.kitchen_station as 'general' | 'grill' | 'fryer' | 'salad' | 'dessert' | 'bar',
              status: 'pending' as const,
            }])
            .select()
            .single();

          if (itemError) throw itemError;

          // Insert modifiers
          if (item.modifiers && item.modifiers.length > 0) {
            const { error: modError } = await supabase
              .from('order_item_modifiers')
              .insert(item.modifiers.map(m => ({
                order_item_id: insertedItem.id,
                modifier_id: m.modifier_id,
                modifier_name: m.modifier_name,
                price_adjustment: m.price_adjustment,
              })));
            if (modError) throw modError;
          }

          // Insert combo selections
          if (item.combo_selections && item.combo_selections.length > 0) {
            const { error: comboError } = await supabase
              .from('order_item_combo_selections')
              .insert(item.combo_selections.map(c => ({
                order_item_id: insertedItem.id,
                combo_component_id: c.combo_component_id,
                selected_product_id: c.selected_product_id,
                selected_product_name: c.selected_product_name,
                qty: c.qty,
              })));
            if (comboError) throw comboError;
          }

          return insertedItem;
        })
      );

      // Update order status
      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: 'preparing' })
        .eq('id', orderId);

      if (orderError) throw orderError;

      toast.success('Order sent to kitchen!');
      navigate('/waiter');
    } catch (error) {
      console.error('Error submitting order:', error);
      toast.error('Failed to submit order');
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + item.line_total, 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading order...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader>
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-xl font-bold">
            Order - Table {order?.restaurant_tables?.table_number}
          </h1>
          <Badge variant="secondary">{order?.status}</Badge>
        </div>
      </AppHeader>

      {selectedProductForCustomization && (
        <>
          <ModifierSelector
            productId={selectedProductForCustomization.id}
            open={modifierDialogOpen}
            onClose={() => {
              setModifierDialogOpen(false);
              setSelectedProductForCustomization(null);
            }}
            onConfirm={handleModifierConfirm}
          />
          <ComboSelector
            comboProductId={selectedProductForCustomization.id}
            open={comboDialogOpen}
            onClose={() => {
              setComboDialogOpen(false);
              setSelectedProductForCustomization(null);
            }}
            onConfirm={handleComboConfirm}
          />
        </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        {/* Products Section */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search menu items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {filteredProducts.map(product => (
                  <Button
                    key={product.id}
                    variant="outline"
                    className="h-auto flex-col items-start p-4 hover:bg-accent relative"
                    onClick={() => openCustomization(product)}
                  >
                    {(hasModifiers.has(product.id) || hasCombos.has(product.id)) && (
                      <Badge variant="secondary" className="absolute top-2 right-2">
                        <Settings className="h-3 w-3" />
                      </Badge>
                    )}
                    <span className="font-semibold text-sm">{product.name}</span>
                    <span className="text-lg font-bold text-primary mt-2">
                      R{product.price.toFixed(2)}
                    </span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Order Items Section */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
              <CardDescription>{orderItems.length} items</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {orderItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No items added yet
                </p>
              ) : (
                <>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {orderItems.map((item, index) => (
                      <div key={index} className="space-y-2 p-3 border rounded-lg">
                        <div className="flex items-start gap-2">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.product_name}</p>
                            <p className="text-xs text-muted-foreground">
                              R{item.price_at_order.toFixed(2)} each
                            </p>
                            {item.modifiers && item.modifiers.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {item.modifiers.map((mod, i) => (
                                  <p key={i} className="text-xs text-muted-foreground">
                                    + {mod.modifier_name}
                                    {mod.price_adjustment !== 0 && ` (R${mod.price_adjustment.toFixed(2)})`}
                                  </p>
                                ))}
                              </div>
                            )}
                            {item.combo_selections && item.combo_selections.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                <p className="text-xs font-semibold text-primary">Combo:</p>
                                {item.combo_selections.map((sel, i) => (
                                  <p key={i} className="text-xs text-muted-foreground">
                                    • {sel.selected_product_name} ×{sel.qty}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => updateItemQty(index, item.qty - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center font-medium">{item.qty}</span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => updateItemQty(index, item.qty + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-sm">R{item.line_total.toFixed(2)}</p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-destructive"
                            onClick={() => removeItem(index)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <Textarea
                          placeholder="Special instructions..."
                          value={item.special_instructions || ''}
                          onChange={(e) => updateItemInstructions(index, e.target.value)}
                          className="text-xs min-h-[60px]"
                        />
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total:</span>
                      <span className="text-primary">R{calculateTotal().toFixed(2)}</span>
                    </div>
                  </div>

                  <Button onClick={submitOrder} className="w-full" size="lg">
                    <Send className="h-4 w-4 mr-2" />
                    Send to Kitchen
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default WaiterOrder;
