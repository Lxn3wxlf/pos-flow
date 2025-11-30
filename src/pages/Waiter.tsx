import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Users, LogOut, Plus, Utensils, Clock, Search, Filter, Bell, ChevronRight } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  order_type: string;
  notes?: string;
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
  const [orderType, setOrderType] = useState<'dine_in' | 'takeout' | 'collection'>('dine_in');
  const [pickupTime, setPickupTime] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

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
        .in('status', ['pending', 'preparing', 'ready', 'confirmed'])
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

      if (orderType === 'collection' && pickupTime) {
        orderData.pickup_time = pickupTime;
      }

      const { data: order, error } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (error) throw error;

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

      navigate(`/waiter/order/${order.id}`);
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Failed to create order');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-500/10 text-green-700 border-green-500/20';
      case 'occupied':
        return 'bg-red-500/10 text-red-700 border-red-500/20';
      case 'reserved':
        return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
      default:
        return 'bg-muted';
    }
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
      case 'preparing':
        return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
      case 'ready':
        return 'bg-green-500/10 text-green-700 border-green-500/20';
      default:
        return 'bg-muted';
    }
  };

  const getOrderStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'preparing':
        return <Utensils className="h-4 w-4" />;
      case 'ready':
        return <Bell className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = searchQuery === '' || 
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.restaurant_tables?.table_number.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const availableTables = tables.filter(t => t.status === 'available');
  const occupiedTables = tables.filter(t => t.status === 'occupied');

  return (
    <div className="min-h-screen bg-background">
      <AppHeader>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
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

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : (
          <>
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-blue-700">{orders.length}</div>
                  <div className="text-xs text-muted-foreground">Active Orders</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-green-700">{availableTables.length}</div>
                  <div className="text-xs text-muted-foreground">Available Tables</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-red-700">{occupiedTables.length}</div>
                  <div className="text-xs text-muted-foreground">Occupied Tables</div>
                </CardContent>
              </Card>
            </div>

            {/* Orders Section */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Active Orders</CardTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setStatusFilter('all')}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search orders..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
                  <TabsList className="w-full grid grid-cols-4 rounded-none border-b">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="pending">Pending</TabsTrigger>
                    <TabsTrigger value="preparing">Preparing</TabsTrigger>
                    <TabsTrigger value="ready">Ready</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value={statusFilter} className="p-4 space-y-3 mt-0">
                    {filteredOrders.length === 0 ? (
                      <div className="text-center py-12">
                        <Utensils className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                        <p className="text-muted-foreground">No orders found</p>
                      </div>
                    ) : (
                      filteredOrders.map(order => (
                        <Card
                          key={order.id}
                          className="cursor-pointer hover:shadow-md transition-all border-l-4"
                          style={{
                            borderLeftColor: 
                              order.status === 'pending' ? '#eab308' :
                              order.status === 'preparing' ? '#3b82f6' :
                              order.status === 'ready' ? '#22c55e' : '#6b7280'
                          }}
                          onClick={() => navigate(`/waiter/order/${order.id}`)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-lg">
                                    Table {order.restaurant_tables?.table_number}
                                  </span>
                                  <Badge className={getOrderStatusColor(order.status)}>
                                    <span className="flex items-center gap-1">
                                      {getOrderStatusIcon(order.status)}
                                      {order.status}
                                    </span>
                                  </Badge>
                                </div>
                                
                                {order.customer_name && (
                                  <p className="text-sm font-medium text-muted-foreground">
                                    {order.customer_name}
                                  </p>
                                )}
                                
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {new Date(order.created_at).toLocaleTimeString([], { 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })}
                                  </span>
                                  {order.guest_count && (
                                    <span className="flex items-center gap-1">
                                      <Users className="h-3 w-3" />
                                      {order.guest_count}
                                    </span>
                                  )}
                                  <Badge variant="outline" className="text-xs">
                                    {order.order_type}
                                  </Badge>
                                </div>
                                
                                {order.notes && (
                                  <p className="text-xs text-muted-foreground italic mt-1">
                                    Note: {order.notes}
                                  </p>
                                )}
                              </div>
                              
                              <ChevronRight className="h-5 w-5 text-muted-foreground mt-1" />
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Tables Grid */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tables</CardTitle>
                <CardDescription>Tap an available table to create new order</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                  {tables.map(table => (
                    <Button
                      key={table.id}
                      variant="outline"
                      className={`h-24 flex-col items-center justify-center gap-2 relative transition-all ${
                        table.status === 'available' 
                          ? 'hover:scale-105 hover:shadow-lg' 
                          : 'opacity-60'
                      }`}
                      onClick={() => {
                        if (table.status === 'available') {
                          setSelectedTable(table);
                          setShowNewOrderDialog(true);
                        }
                      }}
                      disabled={table.status !== 'available'}
                    >
                      <span className="text-2xl font-bold">{table.table_number}</span>
                      <Badge className={getStatusColor(table.status)}>
                        {table.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        <Users className="h-3 w-3 inline mr-1" />
                        {table.seats}
                      </span>
                      {table.status === 'available' && (
                        <Plus className="absolute top-1 right-1 h-4 w-4 text-primary" />
                      )}
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
            <DialogTitle className="text-xl">
              New Order - Table {selectedTable?.table_number}
            </DialogTitle>
            <DialogDescription>
              Set up the order details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Order Type</label>
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
                  variant={orderType === 'takeout' ? 'default' : 'outline'}
                  onClick={() => setOrderType('takeout')}
                  className="w-full"
                >
                  Takeout
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
                <label className="text-sm font-medium">Number of Guests</label>
                <Input
                  type="number"
                  min="1"
                  max={selectedTable?.seats || 10}
                  value={guestCount}
                  onChange={(e) => setGuestCount(parseInt(e.target.value) || 1)}
                />
              </div>
            )}

            {orderType === 'collection' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Pickup Time</label>
                <Input
                  type="datetime-local"
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Customer Name {orderType !== 'dine_in' && <span className="text-destructive">*</span>}
              </label>
              <Input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter customer name"
              />
            </div>

            <div className="flex gap-2 pt-2">
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
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowNewOrderDialog(false);
                  setOrderType('dine_in');
                  setPickupTime('');
                  setCustomerName('');
                }}
              >
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