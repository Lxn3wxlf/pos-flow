import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Package, AlertTriangle, TrendingDown, Plus, ShoppingCart } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import AppHeader from '@/components/AppHeader';

interface StockAlert {
  id: string;
  product_id: string;
  alert_type: string;
  current_stock: number;
  threshold_value: number;
  created_at: string;
  products: {
    name: string;
    sku: string;
    reorder_quantity: number;
  } | null;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  stock_qty: number;
  reorder_point: number;
  reorder_quantity: number;
  cost: number;
}

interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
}

const AdminInventory = () => {
  const { user, profile } = useAuth();
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: ''
  });

  if (!user) return <Navigate to="/auth" />;
  if (!profile?.roles?.includes('admin')) return <Navigate to="/pos" />;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [alertsRes, productsRes, suppliersRes] = await Promise.all([
      supabase
        .from('stock_alerts' as any)
        .select('*, products(name, sku, reorder_quantity)')
        .eq('is_resolved', false)
        .order('created_at', { ascending: false }),
      supabase
        .from('products')
        .select('id, name, sku, stock_qty, reorder_point, reorder_quantity, cost')
        .order('name'),
      supabase
        .from('suppliers' as any)
        .select('*')
        .eq('is_active', true)
        .order('name')
    ]);

    if (alertsRes.data) setAlerts(alertsRes.data as any);
    if (productsRes.data) setProducts(productsRes.data as any);
    if (suppliersRes.data) setSuppliers(suppliersRes.data as any);
  };

  const resolveAlert = async (alertId: string) => {
    const { error } = await supabase
      .from('stock_alerts' as any)
      .update({ is_resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', alertId);

    if (error) {
      toast.error('Failed to resolve alert');
      return;
    }

    toast.success('Alert resolved');
    loadData();
  };

  const createSupplier = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase
      .from('suppliers' as any)
      .insert([supplierForm]);

    if (error) {
      toast.error('Failed to create supplier');
      console.error(error);
      return;
    }

    toast.success('Supplier created successfully');
    setSupplierDialogOpen(false);
    setSupplierForm({ name: '', contact_person: '', email: '', phone: '', address: '' });
    loadData();
  };

  const updateReorderSettings = async (productId: string, reorderPoint: number, reorderQty: number) => {
    const { error } = await supabase
      .from('products')
      .update({ 
        reorder_point: reorderPoint,
        reorder_quantity: reorderQty
      } as any)
      .eq('id', productId);

    if (error) {
      toast.error('Failed to update settings');
      return;
    }

    toast.success('Reorder settings updated');
    loadData();
  };

  const lowStockProducts = products.filter(p => p.stock_qty <= p.reorder_point);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader>
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Inventory Management</h1>
        </div>
      </AppHeader>

      <div className="p-6 space-y-6">
        {/* Alerts Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Low Stock Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{alerts.filter(a => a.alert_type === 'low_stock').length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" />
                Out of Stock
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{alerts.filter(a => a.alert_type === 'out_of_stock').length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-primary" />
                Active Suppliers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{suppliers.length}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="alerts">
          <TabsList>
            <TabsTrigger value="alerts">Stock Alerts</TabsTrigger>
            <TabsTrigger value="reorder">Reorder Settings</TabsTrigger>
            <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          </TabsList>

          <TabsContent value="alerts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Stock Alerts</CardTitle>
                <CardDescription>Products requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Alert Type</TableHead>
                      <TableHead>Current Stock</TableHead>
                      <TableHead>Threshold</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alerts.map((alert) => (
                      <TableRow key={alert.id}>
                        <TableCell className="font-medium">{alert.products?.name || 'N/A'}</TableCell>
                        <TableCell>{alert.products?.sku || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant={alert.alert_type === 'out_of_stock' ? 'destructive' : 'secondary'}>
                            {alert.alert_type.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>{alert.current_stock}</TableCell>
                        <TableCell>{alert.threshold_value}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resolveAlert(alert.id)}
                          >
                            Resolve
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {alerts.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No active alerts</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reorder" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Reorder Point Settings</CardTitle>
                <CardDescription>Configure automatic reorder thresholds</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Current Stock</TableHead>
                      <TableHead>Reorder Point</TableHead>
                      <TableHead>Reorder Quantity</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{product.stock_qty}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="w-20"
                            defaultValue={product.reorder_point}
                            onBlur={(e) => updateReorderSettings(
                              product.id,
                              parseInt(e.target.value),
                              product.reorder_quantity
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="w-20"
                            defaultValue={product.reorder_quantity}
                            onBlur={(e) => updateReorderSettings(
                              product.id,
                              product.reorder_point,
                              parseInt(e.target.value)
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          {product.stock_qty <= product.reorder_point ? (
                            <Badge variant="destructive">Needs Reorder</Badge>
                          ) : (
                            <Badge variant="outline">OK</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="suppliers" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Suppliers</CardTitle>
                    <CardDescription>Manage your supplier relationships</CardDescription>
                  </div>
                  <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Supplier
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Supplier</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={createSupplier} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Supplier Name *</Label>
                          <Input
                            id="name"
                            value={supplierForm.name}
                            onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="contact_person">Contact Person</Label>
                          <Input
                            id="contact_person"
                            value={supplierForm.contact_person}
                            onChange={(e) => setSupplierForm({ ...supplierForm, contact_person: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={supplierForm.email}
                            onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone</Label>
                          <Input
                            id="phone"
                            value={supplierForm.phone}
                            onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                          />
                        </div>
                        <Button type="submit" className="w-full">Create Supplier</Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact Person</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.map((supplier) => (
                      <TableRow key={supplier.id}>
                        <TableCell className="font-medium">{supplier.name}</TableCell>
                        <TableCell>{supplier.contact_person || '-'}</TableCell>
                        <TableCell>{supplier.email || '-'}</TableCell>
                        <TableCell>{supplier.phone || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {suppliers.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No suppliers added yet</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminInventory;
