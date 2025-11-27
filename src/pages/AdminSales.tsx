import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { History, ArrowLeft } from 'lucide-react';
import { Navigate, Link } from 'react-router-dom';

interface Sale {
  id: string;
  cashier_id: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  payment_method: string;
  created_at: string;
  profiles?: {
    full_name: string;
  };
}

const AdminSales = () => {
  const { user, profile } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  if (!user) return <Navigate to="/auth" />;
  if (profile?.role !== 'admin') return <Navigate to="/pos" />;

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      if (data) setSales(data);
    } catch (error) {
      console.error('Error loading sales:', error);
      toast.error('Failed to load sales');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card p-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Sales History</h1>
          </div>
        </div>
      </div>

      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
            <CardDescription>View all sales transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Loading sales...</p>
            ) : sales.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No sales found</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Cashier</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Subtotal</TableHead>
                    <TableHead>Tax</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map(sale => (
                    <TableRow key={sale.id}>
                      <TableCell>
                        {new Date(sale.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>{sale.profiles?.full_name || 'Unknown'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{sale.payment_method}</Badge>
                      </TableCell>
                      <TableCell>${sale.subtotal.toFixed(2)}</TableCell>
                      <TableCell>${sale.tax_amount.toFixed(2)}</TableCell>
                      <TableCell>
                        {sale.discount_amount > 0 ? `-$${sale.discount_amount.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        ${sale.total.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminSales;
