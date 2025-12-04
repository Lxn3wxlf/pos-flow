import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Pencil, Trash2, Key, RefreshCw, Users } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import logo from '@/assets/casbah-logo.svg';
import { hashPIN } from '@/components/PINLogin';

interface Employee {
  id: string;
  full_name: string;
  pin_hash: string | null;
  role: string;
  created_at: string;
  email?: string;
  roles?: string[];
}

const AdminEmployeeAccess = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<'admin' | 'cashier' | 'waiter' | 'kitchen'>('cashier');
  
  // PIN form state
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  if (!user) return <Navigate to="/auth" />;
  if (!profile?.roles?.includes('admin')) return <Navigate to="/pos" />;

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      // Fetch profiles with their roles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');

      if (profilesError) throw profilesError;

      // Fetch roles for each profile
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Merge roles into profiles
      const employeesWithRoles = profiles?.map(p => ({
        ...p,
        roles: userRoles?.filter(r => r.user_id === p.id).map(r => r.role) || []
      })) || [];

      setEmployees(employeesWithRoles);
    } catch (error: any) {
      toast.error('Failed to load employees');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormName(employee.full_name);
    setFormRole(employee.roles?.[0] as any || 'cashier');
    setDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingEmployee(null);
    setFormName('');
    setFormEmail('');
    setFormRole('cashier');
    setDialogOpen(true);
  };

  const handleSaveEmployee = async () => {
    if (!formName.trim()) {
      toast.error('Name is required');
      return;
    }

    try {
      if (editingEmployee) {
        // Update existing employee
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ full_name: formName })
          .eq('id', editingEmployee.id);

        if (profileError) throw profileError;

        // Update role
        const { error: deleteRoleError } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', editingEmployee.id);

        if (deleteRoleError) throw deleteRoleError;

        const { error: insertRoleError } = await supabase
          .from('user_roles')
          .insert({ user_id: editingEmployee.id, role: formRole });

        if (insertRoleError) throw insertRoleError;

        toast.success('Employee updated');
      } else {
        // For new employees, we need to create via auth signup
        // This is a simplified version - in production you'd use admin API
        toast.info('New employees should sign up via the auth page, then you can assign their role here');
        setDialogOpen(false);
        return;
      }

      setDialogOpen(false);
      fetchEmployees();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save employee');
    }
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    if (!confirm(`Are you sure you want to delete ${employee.full_name}?`)) return;

    try {
      // Note: This only removes from profiles, not auth.users
      // Full deletion requires admin API
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', employee.id);

      if (error) throw error;

      toast.success('Employee role removed');
      fetchEmployees();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete employee');
    }
  };

  const openPinDialog = (employee: Employee) => {
    setSelectedEmployee(employee);
    setPin('');
    setConfirmPin('');
    setPinDialogOpen(true);
  };

  const generateRandomPIN = () => {
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
    setPin(randomPin);
    setConfirmPin(randomPin);
    toast.info(`Generated PIN: ${randomPin}`, { duration: 5000 });
  };

  const handleSavePin = async () => {
    if (!selectedEmployee) return;

    if (pin.length < 4 || pin.length > 6) {
      toast.error('PIN must be 4-6 digits');
      return;
    }

    if (!/^\d+$/.test(pin)) {
      toast.error('PIN must contain only numbers');
      return;
    }

    if (pin !== confirmPin) {
      toast.error('PINs do not match');
      return;
    }

    setPinLoading(true);
    try {
      const hashedPin = await hashPIN(pin);
      
      const { error } = await supabase
        .from('profiles')
        .update({ pin_hash: hashedPin })
        .eq('id', selectedEmployee.id);

      if (error) throw error;

      toast.success(`PIN set for ${selectedEmployee.full_name}`);
      setPinDialogOpen(false);
      fetchEmployees();
    } catch (error: any) {
      toast.error(error.message || 'Failed to set PIN');
    } finally {
      setPinLoading(false);
    }
  };

  const handleRemovePin = async () => {
    if (!selectedEmployee) return;

    setPinLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ pin_hash: null })
        .eq('id', selectedEmployee.id);

      if (error) throw error;

      toast.success(`PIN removed for ${selectedEmployee.full_name}`);
      setPinDialogOpen(false);
      fetchEmployees();
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove PIN');
    } finally {
      setPinLoading(false);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'cashier': return 'default';
      case 'waiter': return 'secondary';
      case 'kitchen': return 'outline';
      default: return 'default';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <img 
            src={logo} 
            alt="Casbah Logo" 
            className="h-8 w-auto cursor-pointer hover:opacity-80 transition-opacity" 
            onClick={() => navigate('/admin')}
          />
          <div className="text-left">
            <h1 className="text-xl font-bold">Employee Access</h1>
            <p className="text-sm text-muted-foreground">Manage staff & PINs</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={signOut}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </AppHeader>

      <div className="p-6 space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Employees
            </CardTitle>
            <Button onClick={openNewDialog} disabled>
              <Plus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Note: New employees must first sign up via the login page. You can then manage their roles and PINs here.
            </p>
            
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>PIN Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">{employee.full_name}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {employee.roles?.map((role) => (
                            <Badge key={role} variant={getRoleBadgeVariant(role)}>
                              {role}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={employee.pin_hash ? 'default' : 'outline'}>
                          {employee.pin_hash ? 'PIN Set' : 'No PIN'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(employee.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPinDialog(employee)}
                          >
                            <Key className="h-4 w-4 mr-1" />
                            {employee.pin_hash ? 'Change PIN' : 'Set PIN'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(employee)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteEmployee(employee)}
                            disabled={employee.id === user?.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Employee Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? 'Edit Employee' : 'Add Employee'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Enter full name"
              />
            </div>
            {!editingEmployee && (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="Enter email"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={formRole} onValueChange={(v: any) => setFormRole(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="cashier">Cashier</SelectItem>
                  <SelectItem value="waiter">Waiter</SelectItem>
                  <SelectItem value="kitchen">Kitchen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleSaveEmployee}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PIN Management Dialog */}
      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedEmployee?.pin_hash ? 'Change' : 'Set'} PIN for {selectedEmployee?.full_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="pin">New PIN (4-6 digits)</Label>
              <div className="flex gap-2">
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="Enter PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={generateRandomPIN}
                  title="Generate Random PIN"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPin">Confirm PIN</Label>
              <Input
                id="confirmPin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="Confirm PIN"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1"
                onClick={handleSavePin}
                disabled={pinLoading || pin.length < 4}
              >
                {pinLoading ? 'Saving...' : 'Save PIN'}
              </Button>
              {selectedEmployee?.pin_hash && (
                <Button
                  variant="destructive"
                  onClick={handleRemovePin}
                  disabled={pinLoading}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminEmployeeAccess;