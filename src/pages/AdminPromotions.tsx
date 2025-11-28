import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

interface Promotion {
  id: string;
  name: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  min_purchase_amount: number;
  max_discount_amount: number | null;
  start_date: string;
  end_date: string;
  time_start: string | null;
  time_end: string | null;
  is_active: boolean;
  usage_limit: number | null;
  usage_count: number;
  applies_to: string;
}

const AdminPromotions = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    discount_type: "percentage",
    discount_value: 0,
    min_purchase_amount: 0,
    max_discount_amount: null as number | null,
    start_date: "",
    end_date: "",
    time_start: "",
    time_end: "",
    is_active: true,
    usage_limit: null as number | null,
    applies_to: "all",
  });

  useEffect(() => {
    if (!user || !profile?.roles?.includes("admin")) {
      navigate("/auth");
    } else {
      fetchPromotions();
    }
  }, [user, profile, navigate]);

  const fetchPromotions = async () => {
    const { data, error } = await supabase
      .from("promotions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to fetch promotions");
      console.error(error);
    } else {
      setPromotions(data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase.from("promotions").insert([formData]);

    if (error) {
      toast.error("Failed to create promotion");
      console.error(error);
    } else {
      toast.success("Promotion created successfully");
      setShowForm(false);
      setFormData({
        name: "",
        description: "",
        discount_type: "percentage",
        discount_value: 0,
        min_purchase_amount: 0,
        max_discount_amount: null,
        start_date: "",
        end_date: "",
        time_start: "",
        time_end: "",
        is_active: true,
        usage_limit: null,
        applies_to: "all",
      });
      fetchPromotions();
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("promotions")
      .update({ is_active: !currentStatus })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update promotion");
    } else {
      toast.success("Promotion updated");
      fetchPromotions();
    }
  };

  const deletePromotion = async (id: string) => {
    if (!confirm("Are you sure you want to delete this promotion?")) return;

    const { error } = await supabase.from("promotions").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete promotion");
    } else {
      toast.success("Promotion deleted");
      fetchPromotions();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Promotions</h1>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-2 h-4 w-4" />
            {showForm ? "Cancel" : "New Promotion"}
          </Button>
        </div>
      </AppHeader>

      <div className="container mx-auto p-6">
        {showForm && (
          <Card className="p-6 mb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Promotion Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="discount_type">Discount Type</Label>
                  <Select
                    value={formData.discount_type}
                    onValueChange={(value) => setFormData({ ...formData, discount_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="discount_value">
                    Discount Value {formData.discount_type === "percentage" ? "(%)" : "($)"}
                  </Label>
                  <Input
                    id="discount_value"
                    type="number"
                    step="0.01"
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="min_purchase">Min Purchase ($)</Label>
                  <Input
                    id="min_purchase"
                    type="number"
                    step="0.01"
                    value={formData.min_purchase_amount}
                    onChange={(e) => setFormData({ ...formData, min_purchase_amount: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="max_discount">Max Discount ($)</Label>
                  <Input
                    id="max_discount"
                    type="number"
                    step="0.01"
                    value={formData.max_discount_amount || ""}
                    onChange={(e) => setFormData({ ...formData, max_discount_amount: e.target.value ? parseFloat(e.target.value) : null })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="datetime-local"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="datetime-local"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="time_start">Time Start (Optional)</Label>
                  <Input
                    id="time_start"
                    type="time"
                    value={formData.time_start}
                    onChange={(e) => setFormData({ ...formData, time_start: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="time_end">Time End (Optional)</Label>
                  <Input
                    id="time_end"
                    type="time"
                    value={formData.time_end}
                    onChange={(e) => setFormData({ ...formData, time_end: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>

              <Button type="submit" className="w-full">Create Promotion</Button>
            </form>
          </Card>
        )}

        <div className="grid gap-4">
          {promotions.map((promo) => (
            <Card key={promo.id} className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{promo.name}</h3>
                    <Switch
                      checked={promo.is_active}
                      onCheckedChange={() => toggleActive(promo.id, promo.is_active)}
                    />
                  </div>
                  {promo.description && (
                    <p className="text-muted-foreground mt-1">{promo.description}</p>
                  )}
                  <div className="mt-3 space-y-1 text-sm">
                    <p>
                      <strong>Discount:</strong>{" "}
                      {promo.discount_type === "percentage"
                        ? `${promo.discount_value}%`
                        : `$${promo.discount_value}`}
                    </p>
                    {promo.min_purchase_amount > 0 && (
                      <p><strong>Min Purchase:</strong> ${promo.min_purchase_amount}</p>
                    )}
                    {promo.max_discount_amount && (
                      <p><strong>Max Discount:</strong> ${promo.max_discount_amount}</p>
                    )}
                    <p>
                      <strong>Valid:</strong> {new Date(promo.start_date).toLocaleDateString()} -{" "}
                      {new Date(promo.end_date).toLocaleDateString()}
                    </p>
                    {promo.time_start && promo.time_end && (
                      <p>
                        <strong>Hours:</strong> {promo.time_start} - {promo.time_end}
                      </p>
                    )}
                    {promo.usage_limit && (
                      <p>
                        <strong>Usage:</strong> {promo.usage_count} / {promo.usage_limit}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deletePromotion(promo.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminPromotions;