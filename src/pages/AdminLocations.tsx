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
import { toast } from 'sonner';
import { MapPin, Plus, Building2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import AppHeader from '@/components/AppHeader';

interface Location {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  is_headquarters: boolean;
  created_at: string;
}

const AdminLocations = () => {
  const { user, profile } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    phone: '',
    is_active: true,
    is_headquarters: false
  });

  if (!user) return <Navigate to="/auth" />;
  if (!profile?.roles?.includes('admin')) return <Navigate to="/pos" />;

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    const { data, error } = await supabase
      .from('locations' as any)
      .select('*')
      .order('name');

    if (error) {
      console.error('Error loading locations:', error);
      return;
    }

    setLocations((data || []) as unknown as Location[]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase
      .from('locations' as any)
      .insert([formData]);

    if (error) {
      toast.error('Failed to create location');
      console.error(error);
      return;
    }

    toast.success('Location created successfully');
    setDialogOpen(false);
    setFormData({ name: '', code: '', address: '', phone: '', is_active: true, is_headquarters: false });
    loadLocations();
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('locations' as any)
      .update({ is_active: !currentStatus })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update location');
      return;
    }

    toast.success('Location updated');
    loadLocations();
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader>
        <div className="flex items-center gap-3">
          <MapPin className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Multi-Location Management</h1>
        </div>
      </AppHeader>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Total Locations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{locations.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Active Locations</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{locations.filter(l => l.is_active).length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Headquarters</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-medium">{locations.find(l => l.is_headquarters)?.name || 'Not set'}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Locations</CardTitle>
                <CardDescription>Manage your business locations</CardDescription>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Location
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Location</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Location Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Main Branch"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="code">Location Code *</Label>
                      <Input
                        id="code"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        placeholder="MB01"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="123 Main Street"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+27 11 234 5678"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="is_headquarters"
                        checked={formData.is_headquarters}
                        onChange={(e) => setFormData({ ...formData, is_headquarters: e.target.checked })}
                      />
                      <Label htmlFor="is_headquarters">Headquarters</Label>
                    </div>
                    <Button type="submit" className="w-full">Create Location</Button>
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
                  <TableHead>Code</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((location) => (
                  <TableRow key={location.id}>
                    <TableCell className="font-medium">
                      {location.name}
                      {location.is_headquarters && (
                        <Badge variant="secondary" className="ml-2">HQ</Badge>
                      )}
                    </TableCell>
                    <TableCell>{location.code}</TableCell>
                    <TableCell>{location.address || '-'}</TableCell>
                    <TableCell>{location.phone || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={location.is_active ? 'default' : 'secondary'}>
                        {location.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleActive(location.id, location.is_active)}
                      >
                        {location.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {locations.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No locations added yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminLocations;
