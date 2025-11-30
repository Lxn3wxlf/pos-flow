import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppHeader from "@/components/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, Users, Plus, Edit, Trash, Phone } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Reservation {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  table_id: string | null;
  reservation_date: string;
  reservation_time: string;
  guest_count: number;
  status: string;
  special_requests: string | null;
  restaurant_tables: {
    table_number: string;
  } | null;
}

interface WaitlistEntry {
  id: string;
  customer_name: string;
  customer_phone: string;
  guest_count: number;
  status: string;
  estimated_wait_time: number | null;
  created_at: string;
}

export default function AdminReservations() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    table_id: "",
    reservation_date: format(new Date(), "yyyy-MM-dd"),
    reservation_time: "19:00",
    guest_count: 2,
    status: "pending",
    special_requests: ""
  });

  useEffect(() => {
    fetchReservations();
    fetchWaitlist();
    fetchTables();
  }, []);

  const fetchReservations = async () => {
    try {
      const { data, error } = await supabase
        .from("reservations")
        .select(`
          *,
          restaurant_tables (
            table_number
          )
        `)
        .order("reservation_date", { ascending: true })
        .order("reservation_time", { ascending: true });

      if (error) throw error;
      setReservations(data || []);
    } catch (error) {
      console.error("Error fetching reservations:", error);
      toast.error("Failed to load reservations");
    } finally {
      setLoading(false);
    }
  };

  const fetchWaitlist = async () => {
    try {
      const { data, error } = await supabase
        .from("waitlist")
        .select("*")
        .eq("status", "waiting")
        .order("created_at", { ascending: true });

      if (error) throw error;
      setWaitlist(data || []);
    } catch (error) {
      console.error("Error fetching waitlist:", error);
    }
  };

  const fetchTables = async () => {
    try {
      const { data, error } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("is_active", true)
        .order("table_number");

      if (error) throw error;
      setTables(data || []);
    } catch (error) {
      console.error("Error fetching tables:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingReservation) {
        const { error } = await supabase
          .from("reservations")
          .update(formData)
          .eq("id", editingReservation.id);

        if (error) throw error;
        toast.success("Reservation updated successfully");
      } else {
        const { error } = await supabase
          .from("reservations")
          .insert([formData]);

        if (error) throw error;
        toast.success("Reservation created successfully");
      }

      setShowForm(false);
      setEditingReservation(null);
      resetForm();
      fetchReservations();
    } catch (error) {
      console.error("Error saving reservation:", error);
      toast.error("Failed to save reservation");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this reservation?")) return;

    try {
      const { error } = await supabase
        .from("reservations")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Reservation deleted successfully");
      fetchReservations();
    } catch (error) {
      console.error("Error deleting reservation:", error);
      toast.error("Failed to delete reservation");
    }
  };

  const handleEdit = (reservation: Reservation) => {
    setEditingReservation(reservation);
    setFormData({
      customer_name: reservation.customer_name,
      customer_phone: reservation.customer_phone,
      customer_email: reservation.customer_email || "",
      table_id: reservation.table_id || "",
      reservation_date: reservation.reservation_date,
      reservation_time: reservation.reservation_time,
      guest_count: reservation.guest_count,
      status: reservation.status,
      special_requests: reservation.special_requests || ""
    });
    setShowForm(true);
  };

  const handleSeatWaitlist = async (entry: WaitlistEntry) => {
    try {
      const { error } = await supabase
        .from("waitlist")
        .update({ 
          status: "seated",
          seated_at: new Date().toISOString()
        })
        .eq("id", entry.id);

      if (error) throw error;
      toast.success("Customer seated successfully");
      fetchWaitlist();
    } catch (error) {
      console.error("Error seating customer:", error);
      toast.error("Failed to seat customer");
    }
  };

  const resetForm = () => {
    setFormData({
      customer_name: "",
      customer_phone: "",
      customer_email: "",
      table_id: "",
      reservation_date: format(new Date(), "yyyy-MM-dd"),
      reservation_time: "19:00",
      guest_count: 2,
      status: "pending",
      special_requests: ""
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader>
          <h1 className="text-2xl font-bold">Reservations & Waitlist</h1>
        </AppHeader>
        <div className="container mx-auto p-6">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader>
        <h1 className="text-2xl font-bold">Reservations & Waitlist</h1>
      </AppHeader>
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <Button onClick={() => { setShowForm(!showForm); setEditingReservation(null); resetForm(); }}>
            <Plus className="mr-2 h-4 w-4" />
            New Reservation
          </Button>
        </div>

        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{editingReservation ? "Edit Reservation" : "New Reservation"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="customer_name">Customer Name</Label>
                    <Input
                      id="customer_name"
                      value={formData.customer_name}
                      onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="customer_phone">Phone</Label>
                    <Input
                      id="customer_phone"
                      value={formData.customer_phone}
                      onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="customer_email">Email (Optional)</Label>
                    <Input
                      id="customer_email"
                      type="email"
                      value={formData.customer_email}
                      onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="guest_count">Guest Count</Label>
                    <Input
                      id="guest_count"
                      type="number"
                      min="1"
                      value={formData.guest_count}
                      onChange={(e) => setFormData({ ...formData, guest_count: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="reservation_date">Date</Label>
                    <Input
                      id="reservation_date"
                      type="date"
                      value={formData.reservation_date}
                      onChange={(e) => setFormData({ ...formData, reservation_date: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="reservation_time">Time</Label>
                    <Input
                      id="reservation_time"
                      type="time"
                      value={formData.reservation_time}
                      onChange={(e) => setFormData({ ...formData, reservation_time: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="table_id">Table</Label>
                    <Select
                      value={formData.table_id}
                      onValueChange={(value) => setFormData({ ...formData, table_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select table (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {tables.map((table) => (
                          <SelectItem key={table.id} value={table.id}>
                            Table {table.table_number} ({table.seats} seats)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="seated">Seated</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="special_requests">Special Requests</Label>
                  <Input
                    id="special_requests"
                    value={formData.special_requests}
                    onChange={(e) => setFormData({ ...formData, special_requests: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit">Save Reservation</Button>
                  <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingReservation(null); resetForm(); }}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="reservations">
          <TabsList>
            <TabsTrigger value="reservations">Reservations</TabsTrigger>
            <TabsTrigger value="waitlist">Waitlist ({waitlist.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="reservations" className="space-y-4">
            {reservations.map((reservation) => (
              <Card key={reservation.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span className="font-semibold">{reservation.customer_name}</span>
                        <span className="text-sm text-muted-foreground">({reservation.guest_count} guests)</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(reservation.reservation_date), "MMM dd, yyyy")}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {reservation.reservation_time}
                        </div>
                        <div className="flex items-center gap-1">
                          <Phone className="h-4 w-4" />
                          {reservation.customer_phone}
                        </div>
                      </div>
                      {reservation.restaurant_tables && (
                        <p className="text-sm text-muted-foreground">
                          Table: {reservation.restaurant_tables.table_number}
                        </p>
                      )}
                      {reservation.special_requests && (
                        <p className="text-sm text-muted-foreground">
                          Requests: {reservation.special_requests}
                        </p>
                      )}
                      <span className={`inline-block px-2 py-1 rounded text-xs ${
                        reservation.status === 'completed' ? 'bg-green-100 text-green-800' :
                        reservation.status === 'confirmed' || reservation.status === 'seated' ? 'bg-blue-100 text-blue-800' :
                        reservation.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {reservation.status}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(reservation)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(reservation.id)}>
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="waitlist" className="space-y-4">
            {waitlist.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span className="font-semibold">{entry.customer_name}</span>
                        <span className="text-sm text-muted-foreground">({entry.guest_count} guests)</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Phone className="h-4 w-4" />
                          {entry.customer_phone}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          Added {format(new Date(entry.created_at), "HH:mm")}
                        </div>
                        {entry.estimated_wait_time && (
                          <span className="text-yellow-600">
                            Wait: {entry.estimated_wait_time} min
                          </span>
                        )}
                      </div>
                    </div>
                    <Button size="sm" onClick={() => handleSeatWaitlist(entry)}>
                      Seat Customer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {waitlist.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No customers in waitlist</p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}