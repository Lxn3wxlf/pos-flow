import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Users, LogOut, Plus, Utensils, Clock } from 'lucide-react';
import AppHeader from '@/components/AppHeader';

interface Table {
  id: string;
  table_number: string;
  seats: number;
  status: 'available' | 'occupied' | 'reserved';
  floor_plan_id?: string;
}

interface Order {
  id: string;
  table_id: string;
  order_number: string;
  status: string;
  created_at: string;
  customer_name?: string;
  guest_count?: number;
  restaurant_tables?: {
    table_number: string;
  };
}

const Waiter = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [tables, setTables] = useState<Table[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showNewOrderDialog, setShowNewOrderDialog] = useState(false);
  const [guestCount, setGuestCount] = useState(2);
  const [customerName, setCustomerName] = useState('');
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'collection'>('dine_in');
  const [pickupTime, setPickupTime] = useState('');

  if (!user) return <Navigate to="/auth" />;
  const hasAccess = profile?.roles?.some(r => ['waiter', 'admin'].includes(r));
  if (!hasAccess) return <Navigate to="/pos" />;

  useEffect(() => {
    loadData();
    
    // Set up real-time subscriptions
    const tablesChannel = supabase
      .channel('tables-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, () => {
        loadTables();
      })
      .subscribe();

    const ordersChannel = supabase
      .channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(tablesChannel);
      supabase.removeChannel(ordersChannel);
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadTables(), loadOrders()]);
    setLoading(false);
  };

  const loadTables = async () => {
    try {
      const { data, error } = await supabase
        .from('restaurant_tables')
        .select('*')
        .eq('is_active', true)
        .order('table_number');

      if (error) throw error;
      if (data) setTables(data as Table[]);
    } catch (error) {
      console.error('Error loading tables:', error);
      toast.error('Failed to load tables');
    }
  };

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, restaurant_tables(table_number)')
        .in('status', ['pending', 'preparing', 'ready'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setOrders(data);
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error('Failed to load orders');
    }
  };

  const updateTableStatus = async (tableId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('restaurant_tables')
        .update({ status })
        .eq('id', tableId);

      if (error) throw error;
      toast.success('Table status updated');
      loadTables();
    } catch (error) {
      console.error('Error updating table:', error);
      toast.error('Failed to update table');
    }
  };

  const createNewOrder = async () => {
    if (!selectedTable) return;

    try {
      const orderData: any = {
        table_id: selectedTable.id,
        waiter_id: user!.id,
        order_type: orderType,
        status: 'pending',
        guest_count: orderType === 'dine_in' ? guestCount : null,
        customer_name: customerName || null,
        order_number: `ORD-${Date.now()}`
      };

      // Add pickup time for collection orders
      if (orderType === 'collection' && pickupTime) {
        orderData.pickup_time = pickupTime;
      }

      const { data: order, error } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (error) throw error;

      // Update table status to occupied for dine-in only
      if (orderType === 'dine_in') {
        await updateTableStatus(selectedTable.id, 'occupied');
      }

      toast.success('Order created successfully');
      setShowNewOrderDialog(false);
      setSelectedTable(null);
      setCustomerName('');
      setGuestCount(2);
      setOrderType('dine_in');
      setPickupTime('');

      // Navigate to order details to add items
      navigate(`/waiter/order/${order.id}`);
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Failed to create order');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'default';
      case 'occupied':
        return 'destructive';
      case 'reserved':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'preparing':
        return 'default';
      case 'ready':
        return 'default';
      case 'completed':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Utensils className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Waiter Station</h1>
              <p className="text-sm text-muted-foreground">{profile?.full_name}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </AppHeader>

      <div className="p-6 space-y-6">
        {loading ? (
          <p className="text-center py-8 text-muted-foreground">Loading...</p>
        ) : (
          <>
            {/* Active Orders */}
            <Card>
              <CardHeader>
                <CardTitle>Active Orders</CardTitle>
                <CardDescription>Orders currently being prepared</CardDescription>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No active orders</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {orders.map(order => (
                      <Card
                        key={order.id}
                        className="cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => navigate(`/waiter/order/${order.id}`)}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">
                              Table {order.restaurant_tables?.table_number}
                            </CardTitle>
                            <Badge variant={getOrderStatusColor(order.status)}>
                              {order.status}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {new Date(order.created_at).toLocaleTimeString()}
                          </div>
                          {order.customer_name && (
                            <p className="text-sm font-medium">{order.customer_name}</p>
                          )}
                          {order.guest_count && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Users className="h-4 w-4" />
                              {order.guest_count} guests
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tables Grid */}
            <Card>
              <CardHeader>
                <CardTitle>Tables</CardTitle>
                <CardDescription>Select a table to create a new order</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {tables.map(table => (
                    <Button
                      key={table.id}
                      variant="outline"
                      className="h-24 flex-col items-center justify-center gap-2 relative"
                      onClick={() => {
                        if (table.status === 'available') {
                          setSelectedTable(table);
                          setShowNewOrderDialog(true);
                        }
                      }}
                      disabled={table.status !== 'available'}
                    >
                      <span className="text-2xl font-bold">{table.table_number}</span>
                      <Badge variant={getStatusColor(table.status)} className="text-xs">
                        {table.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        <Users className="h-3 w-3 inline mr-1" />
                        {table.seats}
                      </span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* New Order Dialog */}
      <Dialog open={showNewOrderDialog} onOpenChange={setShowNewOrderDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Order - Table {selectedTable?.table_number}</DialogTitle>
            <DialogDescription>Select order type and enter details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Order Type *</label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={orderType === 'dine_in' ? 'default' : 'outline'}
                  onClick={() => setOrderType('dine_in')}
                  className="w-full"
                >
                  Dine In
                </Button>
                <Button
                  type="button"
                  variant={orderType === 'takeaway' ? 'default' : 'outline'}
                  onClick={() => setOrderType('takeaway')}
                  className="w-full"
                >
                  Takeaway
                </Button>
                <Button
                  type="button"
                  variant={orderType === 'collection' ? 'default' : 'outline'}
                  onClick={() => setOrderType('collection')}
                  className="w-full"
                >
                  Collection
                </Button>
              </div>
            </div>

            {orderType === 'dine_in' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Guest Count *</label>
                <input
                  type="number"
                  min="1"
                  max={selectedTable?.seats || 10}
                  value={guestCount}
                  onChange={(e) => setGuestCount(parseInt(e.target.value) || 1)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base"
                />
              </div>
            )}

            {orderType === 'collection' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Pickup Time *</label>
                <input
                  type="datetime-local"
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Customer Name {orderType !== 'dine_in' ? '*' : '(Optional)'}</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter customer name"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base"
                required={orderType !== 'dine_in'}
              />
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={createNewOrder} 
                className="flex-1"
                disabled={
                  (orderType === 'collection' && !pickupTime) ||
                  (orderType !== 'dine_in' && !customerName)
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Order
              </Button>
              <Button variant="outline" onClick={() => {
                setShowNewOrderDialog(false);
                setOrderType('dine_in');
                setPickupTime('');
              }}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Waiter;
