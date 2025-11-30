import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Clock, ChefHat, CheckCircle2, AlertCircle } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import AppHeader from '@/components/AppHeader';

interface OrderItem {
  id: string;
  product_name: string;
  qty: number;
  special_instructions: string | null;
  status: string;
  kitchen_station: string;
  started_at: string | null;
  weight_amount: number | null;
  weight_unit: string | null;
}

interface Order {
  id: string;
  order_number: string;
  order_type: string;
  customer_name: string | null;
  table_id: string | null;
  created_at: string;
  status: string;
  order_items: OrderItem[];
}

const KitchenDisplay = () => {
  const { user, profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'preparing'>('all');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (!user) return <Navigate to="/auth" />;
  if (!profile?.roles?.some(r => ['kitchen', 'admin'].includes(r))) return <Navigate to="/pos" />;

  useEffect(() => {
    fetchOrders();
    
    // Play notification sound (create a simple beep)
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZizcIGWi77ea');

    // Subscribe to realtime updates
    const channel = supabase
      .channel('kitchen-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            audioRef.current?.play();
            toast.success('New order received!');
          }
          fetchOrders();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items',
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .in('status', ['pending', 'confirmed', 'preparing'])
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching orders:', error);
      return;
    }

    setOrders(data || []);
  };

  const updateItemStatus = async (itemId: string, newStatus: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled') => {
    const { error } = await supabase
      .from('order_items')
      .update({ status: newStatus })
      .eq('id', itemId);

    if (error) {
      toast.error('Failed to update item status');
      console.error(error);
      return;
    }

    toast.success('Item status updated');
    fetchOrders();
  };

  const updateOrderStatus = async (orderId: string, newStatus: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled') => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      toast.error('Failed to update order status');
      console.error(error);
      return;
    }

    toast.success('Order marked as ready');
    fetchOrders();
  };

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    if (filter === 'pending') return order.status === 'pending' || order.status === 'confirmed';
    if (filter === 'preparing') return order.status === 'preparing';
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'destructive';
      case 'confirmed': return 'default';
      case 'preparing': return 'secondary';
      case 'ready': return 'outline';
      default: return 'default';
    }
  };

  const getTimeSince = (createdAt: string) => {
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    return minutes;
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader>
        <div className="flex items-center gap-3">
          <ChefHat className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Kitchen Display System</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All Orders ({orders.length})
          </Button>
          <Button
            variant={filter === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('pending')}
          >
            Pending
          </Button>
          <Button
            variant={filter === 'preparing' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('preparing')}
          >
            Preparing
          </Button>
        </div>
      </AppHeader>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredOrders.map((order) => {
            const timeSince = getTimeSince(order.created_at);
            const isOverdue = timeSince > 20;

            return (
              <Card 
                key={order.id}
                className={`${isOverdue ? 'border-destructive border-2 animate-pulse' : ''}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-2xl font-bold">
                      {order.order_number.split('-').pop()}
                    </CardTitle>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={getStatusColor(order.status)}>
                        {order.status.toUpperCase()}
                      </Badge>
                      <div className={`flex items-center gap-1 text-sm ${isOverdue ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                        <Clock className="h-3 w-3" />
                        {timeSince}m
                        {isOverdue && <AlertCircle className="h-3 w-3 ml-1" />}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <Badge variant="outline">{order.order_type.replace('_', ' ').toUpperCase()}</Badge>
                    {order.customer_name && (
                      <p className="text-muted-foreground">{order.customer_name}</p>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ScrollArea className="max-h-[300px]">
                    <div className="space-y-2">
                      {order.order_items.map((item) => (
                        <div 
                          key={item.id}
                          className="p-3 border rounded-lg space-y-2"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-medium">
                                {item.qty}x {item.product_name}
                                {item.weight_amount && ` (${item.weight_amount}${item.weight_unit})`}
                              </p>
                              {item.special_instructions && (
                                <p className="text-sm text-muted-foreground italic mt-1">
                                  Note: {item.special_instructions}
                                </p>
                              )}
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {item.kitchen_station}
                            </Badge>
                          </div>
                          
                          <div className="flex gap-2">
                            {item.status === 'pending' && (
                              <Button
                                size="sm"
                                className="flex-1"
                                onClick={() => updateItemStatus(item.id, 'preparing')}
                              >
                                Start
                              </Button>
                            )}
                            {item.status === 'preparing' && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="flex-1"
                                onClick={() => updateItemStatus(item.id, 'ready')}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Complete
                              </Button>
                            )}
                            {item.status === 'ready' && (
                              <Badge variant="outline" className="flex-1 justify-center">
                                Ready
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  {order.order_items.every(item => item.status === 'ready') && order.status !== 'ready' && (
                    <Button
                      className="w-full"
                      variant="default"
                      onClick={() => updateOrderStatus(order.id, 'ready')}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Mark Order Ready
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredOrders.length === 0 && (
          <div className="text-center py-20">
            <ChefHat className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-xl text-muted-foreground">No orders to display</p>
            <p className="text-sm text-muted-foreground mt-2">New orders will appear here automatically</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default KitchenDisplay;
