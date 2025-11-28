import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AppHeader from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Search, UserPlus, Phone, Mail, MapPin, Gift } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  address: string | null;
  notes: string | null;
  total_orders: number;
  total_spent: number;
  loyalty_points: number;
  date_of_birth: string | null;
  created_at: string;
}

interface OrderHistory {
  id: string;
  order_number: string;
  order_type: string;
  status: string;
  created_at: string;
  total: number;
}

const AdminCustomers = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [orderHistory, setOrderHistory] = useState<OrderHistory[]>([]);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    if (!user || !profile?.roles?.some(role => ["admin", "cashier", "waiter"].includes(role))) {
      navigate("/auth");
    } else {
      fetchCustomers();
    }
  }, [user, profile, navigate]);

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to fetch customers");
      console.error(error);
    } else {
      setCustomers(data || []);
    }
  };

  const fetchOrderHistory = async (customerId: string) => {
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, order_number, order_type, status, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (ordersError) {
      console.error(ordersError);
      return;
    }

    // Get payment totals for each order
    const ordersWithTotals = await Promise.all(
      (orders || []).map(async (order) => {
        const { data: payments } = await supabase
          .from("payments")
          .select("amount")
          .eq("order_id", order.id);

        const total = payments?.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0) || 0;
        return { ...order, total };
      })
    );

    setOrderHistory(ordersWithTotals);
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    fetchOrderHistory(customer.id);
    setShowDialog(true);
  };

  const updateCustomerNotes = async (customerId: string, notes: string) => {
    const { error } = await supabase
      .from("customers")
      .update({ notes })
      .eq("id", customerId);

    if (error) {
      toast.error("Failed to update notes");
    } else {
      toast.success("Notes updated");
      fetchCustomers();
      if (selectedCustomer) {
        setSelectedCustomer({ ...selectedCustomer, notes });
      }
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <AppHeader>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Customer Management</h1>
        </div>
      </AppHeader>

      <div className="container mx-auto p-6">
        <div className="mb-6 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by name, phone, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="grid gap-4">
          {filteredCustomers.map((customer) => (
            <Card
              key={customer.id}
              className="p-6 cursor-pointer hover:border-primary transition-colors"
              onClick={() => handleSelectCustomer(customer)}
            >
              <div className="flex justify-between items-start">
                <div className="space-y-2 flex-1">
                  <h3 className="text-lg font-semibold">{customer.name}</h3>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      {customer.phone}
                    </div>
                    {customer.email && (
                      <div className="flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        {customer.email}
                      </div>
                    )}
                    {customer.address && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {customer.address}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-sm font-medium">{customer.total_orders} orders</p>
                  <p className="text-sm text-muted-foreground">
                    ${customer.total_spent.toFixed(2)} spent
                  </p>
                  <div className="flex items-center gap-1 text-sm text-primary">
                    <Gift className="h-4 w-4" />
                    {customer.loyalty_points} pts
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCustomer?.name}</DialogTitle>
          </DialogHeader>

          {selectedCustomer && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="history">Order History</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Phone</Label>
                    <p className="text-sm mt-1">{selectedCustomer.phone}</p>
                  </div>
                  {selectedCustomer.email && (
                    <div>
                      <Label>Email</Label>
                      <p className="text-sm mt-1">{selectedCustomer.email}</p>
                    </div>
                  )}
                  {selectedCustomer.address && (
                    <div className="col-span-2">
                      <Label>Address</Label>
                      <p className="text-sm mt-1">{selectedCustomer.address}</p>
                    </div>
                  )}
                  <div>
                    <Label>Total Orders</Label>
                    <p className="text-sm mt-1">{selectedCustomer.total_orders}</p>
                  </div>
                  <div>
                    <Label>Total Spent</Label>
                    <p className="text-sm mt-1">${selectedCustomer.total_spent.toFixed(2)}</p>
                  </div>
                  <div>
                    <Label>Loyalty Points</Label>
                    <p className="text-sm mt-1">{selectedCustomer.loyalty_points}</p>
                  </div>
                  {selectedCustomer.date_of_birth && (
                    <div>
                      <Label>Date of Birth</Label>
                      <p className="text-sm mt-1">
                        {new Date(selectedCustomer.date_of_birth).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="history" className="space-y-3">
                {orderHistory.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No orders yet</p>
                ) : (
                  orderHistory.map((order) => (
                    <Card key={order.id} className="p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">{order.order_number}</p>
                          <p className="text-sm text-muted-foreground">
                            {order.order_type} • {new Date(order.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">${order.total.toFixed(2)}</p>
                          <p className="text-sm text-muted-foreground">{order.status}</p>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="notes">
                <Textarea
                  placeholder="Add notes about this customer..."
                  value={selectedCustomer.notes || ""}
                  onChange={(e) =>
                    setSelectedCustomer({ ...selectedCustomer, notes: e.target.value })
                  }
                  rows={8}
                />
                <Button
                  className="mt-4 w-full"
                  onClick={() => updateCustomerNotes(selectedCustomer.id, selectedCustomer.notes || "")}
                >
                  Save Notes
                </Button>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCustomers;