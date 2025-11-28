import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ChefHat, LogOut, Clock, CheckCircle } from 'lucide-react';
import AppHeader from '@/components/AppHeader';

interface OrderItem {
  id: string;
  order_id: string;
  product_name: string;
  qty: number;
  special_instructions?: string;
  status: string;
  kitchen_station: string;
  created_at: string;
  orders?: {
    order_number: string;
    restaurant_tables?: {
      table_number: string;
    };
  };
}

const Kitchen = () => {
  const { user, profile, signOut } = useAuth();
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStation, setSelectedStation] = useState<string>('all');

  if (!user) return <Navigate to="/auth" />;
  const hasAccess = profile?.roles?.some(r => ['kitchen', 'admin'].includes(r));
  if (!hasAccess) return <Navigate to="/pos" />;

  useEffect(() => {
    loadOrderItems();

    // Real-time subscription for order items
    const channel = supabase
      .channel('order-items-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        loadOrderItems();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadOrderItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          *,
          orders!inner(
            order_number,
            restaurant_tables(table_number)
          )
        `)
        .in('status', ['pending', 'preparing'])
        .order('created_at', { ascending: true });

      if (error) throw error;
      setOrderItems(data || []);
    } catch (error) {
      console.error('Error loading order items:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const updateItemStatus = async (itemId: string, newStatus: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled') => {
    try {
      const { error } = await supabase
        .from('order_items')
        .update({ status: newStatus })
        .eq('id', itemId);

      if (error) throw error;

      toast.success(`Item marked as ${newStatus}`);
      loadOrderItems();
    } catch (error) {
      console.error('Error updating item status:', error);
      toast.error('Failed to update status');
    }
  };

  const getStationColor = (station: string) => {
    switch (station) {
      case 'grill':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'fryer':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'salad':
        return 'bg-success/10 text-success border-success/20';
      case 'dessert':
        return 'bg-primary/10 text-primary border-primary/20';
      default:
        return 'bg-muted/10 text-muted-foreground border-muted/20';
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'pending' ? 'secondary' : 'default';
  };

  const filteredItems = selectedStation === 'all' 
    ? orderItems 
    : orderItems.filter(item => item.kitchen_station === selectedStation);

  const stations = ['all', 'general', 'grill', 'fryer', 'salad', 'dessert'];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ChefHat className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Kitchen Display</h1>
              <p className="text-sm text-muted-foreground">{profile?.full_name}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </AppHeader>

      <div className="p-6">
        <Tabs value={selectedStation} onValueChange={setSelectedStation}>
          <TabsList className="mb-6">
            {stations.map(station => (
              <TabsTrigger key={station} value={station} className="capitalize">
                {station}
                {station !== 'all' && (
                  <Badge variant="secondary" className="ml-2">
                    {orderItems.filter(item => item.kitchen_station === station).length}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={selectedStation}>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Loading orders...</p>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
                <p className="text-xl font-semibold">All caught up!</p>
                <p className="text-muted-foreground">No pending orders</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredItems.map(item => (
                  <Card 
                    key={item.id} 
                    className={`${item.status === 'pending' ? 'border-primary' : ''}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-base mb-1">
                            Table {item.orders?.restaurant_tables?.table_number}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">
                            {item.orders?.order_number}
                          </p>
                        </div>
                        <Badge 
                          variant={getStatusColor(item.status)}
                          className="capitalize"
                        >
                          {item.status}
                        </Badge>
                      </div>
                      <Badge 
                        className={`${getStationColor(item.kitchen_station)} capitalize mt-2`}
                      >
                        {item.kitchen_station}
                      </Badge>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="font-bold text-lg">{item.product_name}</p>
                        <p className="text-2xl font-bold text-primary">x{item.qty}</p>
                      </div>

                      {item.special_instructions && (
                        <div className="p-2 bg-warning/10 border border-warning/20 rounded">
                          <p className="text-xs font-semibold text-warning mb-1">
                            Special Instructions:
                          </p>
                          <p className="text-sm">{item.special_instructions}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(item.created_at).toLocaleTimeString()}
                      </div>

                      <div className="flex gap-2 pt-2">
                        {item.status === 'pending' && (
                          <Button
                            onClick={() => updateItemStatus(item.id, 'preparing')}
                            className="flex-1"
                            size="sm"
                          >
                            Start
                          </Button>
                        )}
                        {item.status === 'preparing' && (
                          <Button
                            onClick={() => updateItemStatus(item.id, 'ready')}
                            className="flex-1"
                            size="sm"
                            variant="default"
                          >
                            Ready
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Kitchen;
