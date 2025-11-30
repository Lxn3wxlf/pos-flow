import { useAuth } from '@/contexts/AuthContext';
import { useSyncEngine } from '@/hooks/useSyncEngine';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { Package, BarChart3, History as HistoryIcon, LogOut, Wifi, WifiOff, RefreshCw, Truck, Percent, Users, MapPin, ChefHat, Calendar, Clock, Users as UsersIcon } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import logo from '@/assets/casbah-logo.svg';

const Admin = () => {
  const { user, profile, signOut } = useAuth();
  const { isOnline, isSyncing, sync, lastSync } = useSyncEngine(user?.id);
  const navigate = useNavigate();

  if (!user) return <Navigate to="/auth" />;
  if (!profile?.roles?.includes('admin')) return <Navigate to="/pos" />;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader>
        <div className="flex items-center gap-3">
          <img 
            src={logo} 
            alt="Casbah Logo" 
            className="h-8 w-auto cursor-pointer hover:opacity-80 transition-opacity" 
            onClick={() => navigate('/admin')}
          />
          <div className="text-left">
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">{profile?.full_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isOnline ? "default" : "destructive"} className="gap-1">
            {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {isOnline ? 'Online' : 'Offline'}
          </Badge>
          {isSyncing && <Badge variant="secondary">Syncing...</Badge>}
          {lastSync && (
            <span className="text-xs text-muted-foreground">
              Last sync: {lastSync.toLocaleTimeString()}
            </span>
          )}
          <Button variant="ghost" size="icon" onClick={sync} disabled={isSyncing}>
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </AppHeader>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link to="/admin/modifiers">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Package className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Modifiers</CardTitle>
                    <CardDescription>Toppings & extras</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Manage product modifiers, toppings, and customizations
                </p>
              </CardContent>
            </Link>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link to="/admin/combos">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Package className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Combos</CardTitle>
                    <CardDescription>Meal deals</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Create and manage combo meals and bundle offers
                </p>
              </CardContent>
            </Link>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link to="/admin/product-modifiers">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Package className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Link Modifiers</CardTitle>
                    <CardDescription>Product setup</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Link modifiers to specific products
                </p>
              </CardContent>
            </Link>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link to="/admin/sales">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-accent/10 rounded-lg">
                    <HistoryIcon className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <CardTitle>Sales History</CardTitle>
                    <CardDescription>View transactions</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Review all sales and transaction details
                </p>
              </CardContent>
            </Link>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link to="/admin/reports">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-success/10 rounded-lg">
                    <BarChart3 className="h-6 w-6 text-success" />
                  </div>
                  <div>
                    <CardTitle>Reports</CardTitle>
                    <CardDescription>Analytics & insights</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Sales reports, profit analysis, and exports
                </p>
              </CardContent>
            </Link>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link to="/admin/inventory">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-500/10 rounded-lg">
                    <Package className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <CardTitle>Inventory</CardTitle>
                    <CardDescription>Stock management</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Track stock levels, reorder points, and supplier management
                </p>
              </CardContent>
            </Link>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link to="/admin/locations">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-500/10 rounded-lg">
                    <MapPin className="h-6 w-6 text-indigo-500" />
                  </div>
                  <div>
                    <CardTitle>Locations</CardTitle>
                    <CardDescription>Multi-branch setup</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Manage multiple business locations and branch operations
                </p>
              </CardContent>
            </Link>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link to="/kitchen-display">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-red-500/10 rounded-lg">
                    <ChefHat className="h-6 w-6 text-red-500" />
                  </div>
                  <div>
                    <CardTitle>Kitchen Display</CardTitle>
                    <CardDescription>Real-time orders</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Live kitchen display system with order tracking and alerts
                </p>
              </CardContent>
            </Link>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link to="/delivery">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-500/10 rounded-lg">
                    <Truck className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <CardTitle>Delivery Orders</CardTitle>
                    <CardDescription>Manage deliveries</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Track and manage delivery orders and assignments
                </p>
              </CardContent>
            </Link>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link to="/admin/promotions">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-orange-500/10 rounded-lg">
                    <Percent className="h-6 w-6 text-orange-500" />
                  </div>
                  <div>
                    <CardTitle>Promotions</CardTitle>
                    <CardDescription>Discounts & deals</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Create time-based discounts and promotional campaigns
                </p>
              </CardContent>
            </Link>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link to="/admin/customers">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-500/10 rounded-lg">
                    <UsersIcon className="h-6 w-6 text-purple-500" />
                  </div>
                  <div>
                    <CardTitle>Customers</CardTitle>
                    <CardDescription>Customer management</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Manage customer details, history, and loyalty points
                </p>
              </CardContent>
            </Link>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link to="/admin/schedule">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-teal-500/10 rounded-lg">
                    <Calendar className="h-6 w-6 text-teal-500" />
                  </div>
                  <div>
                    <CardTitle>Employee Schedule</CardTitle>
                    <CardDescription>Shift management</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Create and manage employee shifts and schedules
                </p>
              </CardContent>
            </Link>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link to="/time-tracking">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-cyan-500/10 rounded-lg">
                    <Clock className="h-6 w-6 text-cyan-500" />
                  </div>
                  <div>
                    <CardTitle>Time Tracking</CardTitle>
                    <CardDescription>Clock in/out</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Employee time tracking with labor cost reporting
                </p>
              </CardContent>
            </Link>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <Link to="/admin/reservations">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-pink-500/10 rounded-lg">
                    <UsersIcon className="h-6 w-6 text-pink-500" />
                  </div>
                  <div>
                    <CardTitle>Reservations</CardTitle>
                    <CardDescription>Table bookings</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Manage reservations, waitlist, and table bookings
                </p>
              </CardContent>
            </Link>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-3 flex-wrap">
            <Button asChild>
              <Link to="/admin/products?action=new">Add New Product</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/pos">Open POS Register</Link>
            </Button>
            <Button variant="outline" onClick={sync} disabled={!isOnline || isSyncing}>
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Admin;
