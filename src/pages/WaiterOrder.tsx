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
import { Plus, Minus, Trash2, Send, Search, Settings, ArrowLeft, ShoppingCart, Filter } from 'lucide-react';
import { getCategoryIcon, getCategoryIconColor } from '@/lib/categoryIcons';
import AppHeader from '@/components/AppHeader';
import ModifierSelector, { SelectedModifier } from '@/components/ModifierSelector';
import ComboSelector, { ComboSelection } from '@/components/ComboSelector';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Product {
  id: string;
  name: string;
  price: number;
  cost: number;
  tax_rate: number;
  kitchen_station?: string;
  category_id?: string;
  category_name?: string;
  image_url?: string;
}

interface Category {
  id: string;
  name: string;
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [modifierDialogOpen, setModifierDialogOpen] = useState(false);
  const [comboDialogOpen, setComboDialogOpen] = useState(false);
  const [selectedProductForCustomization, setSelectedProductForCustomization] = useState<Product | null>(null);
  const [hasModifiers, setHasModifiers] = useState<Set<string>>(new Set());
  const [hasCombos, setHasCombos] = useState<Set<string>>(new Set());
  const [showCart, setShowCart] = useState(false);

  if (!user) return <Navigate to="/auth" />;
  const hasAccess = profile?.roles?.some(r => ['waiter', 'admin'].includes(r));
  if (!hasAccess) return <Navigate to="/pos" />;

  useEffect(() => {
    loadOrder();
    loadProducts();
    loadCategories();
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
        .select('*, categories(name)')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts((data || []).map(p => ({
        ...p,
        category_name: p.categories?.name || null
      })));
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
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
    setShowCart(true);
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
    if (orderItems.length === 1) setShowCart(false);
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
      await Promise.all(
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

      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: 'confirmed' })
        .eq('id', orderId);

      if (orderError) throw orderError;

      toast.success('Order sent to kitchen!');
      navigate('/waiter');
    } catch (error) {
      console.error('Error submitting order:', error);
      toast.error('Failed to submit order');
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

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
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/waiter')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">
                Table {order?.restaurant_tables?.table_number}
              </h1>
              <p className="text-xs text-muted-foreground">{order?.order_number}</p>
            </div>
            <Badge variant="secondary">{order?.status}</Badge>
          </div>
          <Button
            variant="default"
            size="sm"
            className="relative"
            onClick={() => setShowCart(!showCart)}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            {orderItems.length > 0 && (
              <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center">
                {orderItems.length}
              </Badge>
            )}
          </Button>
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

      <div className="p-4">
        <div className={`grid ${showCart ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'} gap-4`}>
          {/* Products Section */}
          <Card className="flex flex-col h-[calc(100vh-12rem)]">
            <CardHeader className="pb-3">
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search menu..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <ScrollArea className="w-full whitespace-nowrap">
                  <div className="flex gap-2">
                    <Button
                      variant={selectedCategory === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedCategory('all')}
                    >
                      All
                    </Button>
                    {categories.map(cat => (
                      <Button
                        key={cat.id}
                        variant={selectedCategory === cat.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedCategory(cat.id)}
                      >
                        {cat.name}
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {filteredProducts.map(product => {
                  const CategoryIcon = getCategoryIcon(product.category_name);
                  const iconColor = getCategoryIconColor(product.category_name);
                  return (
                    <Button
                      key={product.id}
                      variant="outline"
                      className="h-auto flex-col items-start p-3 hover:bg-accent hover:scale-105 transition-transform relative"
                      onClick={() => openCustomization(product)}
                    >
                      {(hasModifiers.has(product.id) || hasCombos.has(product.id)) && (
                        <Badge variant="secondary" className="absolute top-2 right-2 h-6 w-6 p-0 flex items-center justify-center">
                          <Settings className="h-3 w-3" />
                        </Badge>
                      )}
                      <div className="w-full aspect-square mb-2 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                        {product.image_url ? (
                          <img 
                            src={product.image_url} 
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <CategoryIcon className={`h-10 w-10 ${iconColor}`} />
                        )}
                      </div>
                      <span className="font-semibold text-sm line-clamp-2">{product.name}</span>
                      <span className="text-lg font-bold text-primary mt-2">
                        R{product.price.toFixed(2)}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Cart Section */}
          {showCart && (
            <Card className="flex flex-col h-[calc(100vh-12rem)]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Order Items</CardTitle>
                    <CardDescription>{orderItems.length} items</CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCart(false)}
                    className="lg:hidden"
                  >
                    Hide
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto space-y-3">
                {orderItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <ShoppingCart className="h-16 w-16 text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground">No items added yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Select items from the menu to get started
                    </p>
                  </div>
                ) : (
                  <>
                    {orderItems.map((item, index) => (
                      <Card key={index} className="border-l-4 border-l-primary">
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm line-clamp-1">{item.product_name}</p>
                              <p className="text-xs text-muted-foreground">
                                R{item.price_at_order.toFixed(2)} each
                              </p>
                              {item.modifiers && item.modifiers.length > 0 && (
                                <div className="mt-1 space-y-0.5">
                                  {item.modifiers.map((mod, i) => (
                                    <p key={i} className="text-xs text-muted-foreground">
                                      + {mod.modifier_name}
                                      {mod.price_adjustment !== 0 && ` (+R${mod.price_adjustment.toFixed(2)})`}
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
                            <div className="flex flex-col items-end gap-2">
                              <div className="flex items-center gap-1 bg-muted rounded-md">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => updateItemQty(index, item.qty - 1)}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-8 text-center font-medium text-sm">{item.qty}</span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => updateItemQty(index, item.qty + 1)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                              <p className="font-bold text-sm">R{item.line_total.toFixed(2)}</p>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive"
                              onClick={() => removeItem(index)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <Textarea
                            placeholder="Special instructions..."
                            value={item.special_instructions || ''}
                            onChange={(e) => updateItemInstructions(index, e.target.value)}
                            className="text-xs min-h-[50px]"
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </>
                )}
              </CardContent>
              {orderItems.length > 0 && (
                <>
                  <Separator />
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Total</span>
                      <span className="text-primary">R{calculateTotal().toFixed(2)}</span>
                    </div>
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={submitOrder}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send to Kitchen
                    </Button>
                  </CardContent>
                </>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default WaiterOrder;