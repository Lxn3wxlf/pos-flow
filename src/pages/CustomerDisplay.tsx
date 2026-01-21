import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';
import logo from '@/assets/casbah-logo.svg';

interface ReadyOrder {
  id: string;
  order_number: string;
  customer_name: string | null;
  order_type: string;
  updated_at: string;
}

const CustomerDisplay = () => {
  const [readyOrders, setReadyOrders] = useState<ReadyOrder[]>([]);

  useEffect(() => {
    // Fetch initial ready orders
    fetchReadyOrders();

    // Subscribe to order updates
    const channel = supabase
      .channel('ready-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: 'status=eq.ready',
        },
        () => {
          fetchReadyOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchReadyOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, order_type, updated_at')
      .eq('status', 'ready')
      .order('updated_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching ready orders:', error);
      return;
    }

    setReadyOrders(data || []);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <img 
            src={logo} 
            alt="Mr Tech Solutions Logo"
            className="h-20 w-auto mx-auto"
          />
          <h1 className="text-5xl font-bold text-primary">Order Ready for Pickup</h1>
          <p className="text-xl text-muted-foreground">Please collect your order when your number is called</p>
        </div>

        {/* Ready Orders Grid */}
        {readyOrders.length === 0 ? (
          <Card className="border-2">
            <CardContent className="flex items-center justify-center py-20">
              <div className="text-center space-y-4">
                <CheckCircle2 className="h-16 w-16 text-muted-foreground mx-auto" />
                <p className="text-2xl text-muted-foreground">No orders ready at the moment</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {readyOrders.map((order, index) => (
              <Card 
                key={order.id}
                className={`border-4 transition-all duration-300 ${
                  index === 0 
                    ? 'border-primary shadow-2xl shadow-primary/50 scale-105' 
                    : 'border-accent'
                }`}
              >
                <CardContent className="p-8 text-center space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Order Number
                    </p>
                    <p className="text-6xl font-bold text-primary">
                      {order.order_number.split('-').pop()}
                    </p>
                  </div>
                  
                  {order.customer_name && (
                    <p className="text-lg font-medium text-foreground truncate">
                      {order.customer_name}
                    </p>
                  )}
                  
                  <Badge 
                    variant="secondary" 
                    className="text-sm px-4 py-1"
                  >
                    {order.order_type.replace('_', ' ').toUpperCase()}
                  </Badge>

                  {index === 0 && (
                    <div className="pt-4 animate-pulse">
                      <Badge variant="default" className="text-base px-6 py-2">
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        READY NOW
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-muted-foreground">
          <p className="text-lg">Thank you for your patience!</p>
        </div>
      </div>
    </div>
  );
};

export default CustomerDisplay;
