import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, MapPin, Clock, User } from 'lucide-react';
import { toast } from 'sonner';

interface DeliveryOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  status: string;
  estimated_delivery: string | null;
  delivery_fee: number;
  created_at: string;
}

const Delivery = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) {
      navigate('/auth');
      return;
    }

    if (!profile.roles?.includes('admin') && !profile.roles?.includes('waiter')) {
      toast.error('Access denied');
      navigate('/');
      return;
    }

    fetchDeliveries();
  }, [profile, navigate]);

  const fetchDeliveries = async () => {
    try {
      const { data, error } = await supabase
        .from('delivery_assignments')
        .select(`
          id,
          status,
          estimated_delivery,
          delivery_fee,
          delivery_notes,
          created_at,
          orders!inner (
            id,
            order_number,
            customer_name
          ),
          customers!inner (
            phone
          ),
          delivery_addresses!inner (
            address_line1,
            address_line2,
            city,
            postal_code
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = data?.map((d: any) => ({
        id: d.id,
        order_number: d.orders.order_number,
        customer_name: d.orders.customer_name,
        customer_phone: d.customers.phone,
        address: `${d.delivery_addresses.address_line1}${d.delivery_addresses.address_line2 ? ', ' + d.delivery_addresses.address_line2 : ''}, ${d.delivery_addresses.city}, ${d.delivery_addresses.postal_code}`,
        status: d.status,
        estimated_delivery: d.estimated_delivery,
        delivery_fee: d.delivery_fee,
        created_at: d.created_at,
      })) || [];

      setDeliveries(formatted);
    } catch (error: any) {
      console.error('Error fetching deliveries:', error);
      toast.error('Failed to load deliveries');
    } finally {
      setLoading(false);
    }
  };

  const updateDeliveryStatus = async (id: string, status: string) => {
    try {
      const updates: any = { status };
      
      if (status === 'picked_up') {
        updates.pickup_time = new Date().toISOString();
      } else if (status === 'delivered') {
        updates.delivery_time = new Date().toISOString();
      }

      const { error } = await supabase
        .from('delivery_assignments')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast.success('Status updated');
      fetchDeliveries();
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'assigned': return 'bg-blue-500';
      case 'picked_up': return 'bg-purple-500';
      case 'delivered': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const filterByStatus = (status: string) => {
    if (status === 'all') return deliveries;
    return deliveries.filter(d => d.status === status);
  };

  const renderDeliveryCard = (delivery: DeliveryOrder) => (
    <Card key={delivery.id} className="p-4 space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-lg">{delivery.order_number}</h3>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <User className="h-3 w-3" />
            {delivery.customer_name}
          </p>
        </div>
        <Badge className={getStatusColor(delivery.status)}>
          {delivery.status}
        </Badge>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
          <p>{delivery.address}</p>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            {delivery.estimated_delivery
              ? `ETA: ${new Date(delivery.estimated_delivery).toLocaleTimeString()}`
              : 'No ETA set'}
          </p>
        </div>
        <p className="font-semibold">Delivery Fee: R{delivery.delivery_fee.toFixed(2)}</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {delivery.status === 'pending' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateDeliveryStatus(delivery.id, 'assigned')}
          >
            Assign Driver
          </Button>
        )}
        {delivery.status === 'assigned' && (
          <Button
            size="sm"
            onClick={() => updateDeliveryStatus(delivery.id, 'picked_up')}
          >
            Mark Picked Up
          </Button>
        )}
        {delivery.status === 'picked_up' && (
          <Button
            size="sm"
            onClick={() => updateDeliveryStatus(delivery.id, 'delivered')}
          >
            Mark Delivered
          </Button>
        )}
        {(delivery.status === 'pending' || delivery.status === 'assigned') && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => updateDeliveryStatus(delivery.id, 'cancelled')}
          >
            Cancel
          </Button>
        )}
      </div>
    </Card>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader>
          <h1 className="text-2xl font-bold text-center">Delivery Management</h1>
        </AppHeader>
        <div className="p-4">
          <p className="text-center text-muted-foreground">Loading deliveries...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader>
        <h1 className="text-2xl font-bold text-center">Delivery Management</h1>
        <div className="flex justify-center mt-2">
          <Button onClick={() => navigate('/delivery/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            New Delivery Order
          </Button>
        </div>
      </AppHeader>

      <div className="p-4">
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="assigned">Assigned</TabsTrigger>
            <TabsTrigger value="picked_up">Picked Up</TabsTrigger>
            <TabsTrigger value="delivered">Delivered</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-3 mt-4">
            {deliveries.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No deliveries yet</p>
            ) : (
              deliveries.map(renderDeliveryCard)
            )}
          </TabsContent>

          {['pending', 'assigned', 'picked_up', 'delivered'].map(status => (
            <TabsContent key={status} value={status} className="space-y-3 mt-4">
              {filterByStatus(status).length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No {status} deliveries
                </p>
              ) : (
                filterByStatus(status).map(renderDeliveryCard)
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
};

export default Delivery;