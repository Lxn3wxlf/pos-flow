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
import { Plus, Minus, Trash2, Send, Search } from 'lucide-react';
import AppHeader from '@/components/AppHeader';

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

  if (!user) return <Navigate to="/auth" />;
  const hasAccess = profile?.roles?.some(r => ['waiter', 'admin'].includes(r));
  if (!hasAccess) return <Navigate to="/pos" />;

  useEffect(() => {
    loadOrder();
    loadProducts();
  }, [orderId]);

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
      setOrderItems(itemsData || []);
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

  const addItem = (product: Product) => {
    const existing = orderItems.find(item => item.product_id === product.id);
    if (existing) {
      updateItemQty(existing.product_id, existing.qty + 1);
    } else {
      const newItem: OrderItem = {
        product_id: product.id,
        product_name: product.name,
        product_sku: product.id,
        qty: 1,
        price_at_order: product.price,
        cost_at_order: product.cost,
        tax_rate: product.tax_rate,
        line_total: product.price,
        kitchen_station: product.kitchen_station || 'general'
      };
      setOrderItems([...orderItems, newItem]);
    }
    toast.success(`Added ${product.name}`);
  };

  const updateItemQty = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      removeItem(productId);
      return;
    }
    setOrderItems(orderItems.map(item => 
      item.product_id === productId 
        ? { ...item, qty: newQty, line_total: item.price_at_order * newQty }
        : item
    ));
  };

  const removeItem = (productId: string) => {
    setOrderItems(orderItems.filter(item => item.product_id !== productId));
  };

  const updateItemInstructions = (productId: string, instructions: string) => {
    setOrderItems(orderItems.map(item =>
      item.product_id === productId ? { ...item, special_instructions: instructions } : item
    ));
  };

  const submitOrder = async () => {
    if (orderItems.length === 0) {
      toast.error('Please add items to the order');
      return;
    }

    try {
      // Insert order items
      const itemsToInsert = orderItems.map(item => ({
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
        status: 'pending' as const
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

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
                    className="h-auto flex-col items-start p-4 hover:bg-accent"
                    onClick={() => addItem(product)}
                  >
                    <span className="font-semibold text-sm">{product.name}</span>
                    <span className="text-lg font-bold text-primary mt-2">
                      ${product.price.toFixed(2)}
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
                      <div key={`${item.product_id}-${index}`} className="space-y-2 p-3 border rounded-lg">
                        <div className="flex items-start gap-2">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.product_name}</p>
                            <p className="text-xs text-muted-foreground">
                              ${item.price_at_order.toFixed(2)} each
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => updateItemQty(item.product_id, item.qty - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center font-medium">{item.qty}</span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => updateItemQty(item.product_id, item.qty + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-sm">${item.line_total.toFixed(2)}</p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-destructive"
                            onClick={() => removeItem(item.product_id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <Textarea
                          placeholder="Special instructions..."
                          value={item.special_instructions || ''}
                          onChange={(e) => updateItemInstructions(item.product_id, e.target.value)}
                          className="text-xs min-h-[60px]"
                        />
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total:</span>
                      <span className="text-primary">${calculateTotal().toFixed(2)}</span>
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
