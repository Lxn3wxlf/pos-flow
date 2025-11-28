import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { BarChart3, ArrowLeft, Download, TrendingUp, Package, DollarSign } from 'lucide-react';
import { Navigate, Link } from 'react-router-dom';

interface ReportData {
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
  productCount: number;
  averageOrderValue: number;
}

const AdminReports = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<ReportData>({
    totalSales: 0,
    totalRevenue: 0,
    totalProfit: 0,
    productCount: 0,
    averageOrderValue: 0
  });

  if (!user) return <Navigate to="/auth" />;
  if (!profile?.roles?.includes('admin')) return <Navigate to="/pos" />;

  useEffect(() => {
    loadReportData();
  }, []);

  const loadReportData = async () => {
    setLoading(true);
    try {
      // Get sales summary
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('total');

      if (salesError) throw salesError;

      // Get product count
      const { count: productCount, error: productsError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      if (productsError) throw productsError;

      // Get sale items for profit calculation
      const { data: saleItems, error: itemsError } = await supabase
        .from('sale_items')
        .select('price_at_sale, cost_at_sale, qty');

      if (itemsError) throw itemsError;

      // Calculate metrics
      const totalRevenue = sales?.reduce((sum, sale) => sum + sale.total, 0) || 0;
      const totalSales = sales?.length || 0;
      const totalProfit = saleItems?.reduce((sum, item) => 
        sum + ((item.price_at_sale - item.cost_at_sale) * item.qty), 0
      ) || 0;
      const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

      setReportData({
        totalSales,
        totalRevenue,
        totalProfit,
        productCount: productCount || 0,
        averageOrderValue
      });
    } catch (error) {
      console.error('Error loading report data:', error);
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = async () => {
    try {
      const { data: sales, error } = await supabase
        .from('sales')
        .select('*, sale_items(*), profiles(full_name)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Convert to CSV
      let csv = 'Date,Cashier,Payment Method,Subtotal,Tax,Discount,Total\n';
      sales?.forEach(sale => {
        csv += `${new Date(sale.created_at).toLocaleString()},${sale.profiles?.full_name || 'Unknown'},${sale.payment_method},${sale.subtotal},${sale.tax_amount},${sale.discount_amount},${sale.total}\n`;
      });

      // Download
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sales-report-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success('Report exported successfully');
    } catch (error) {
      console.error('Error exporting report:', error);
      toast.error('Failed to export report');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/admin">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Reports & Analytics</h1>
            </div>
          </div>
          <Button onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {loading ? (
          <p className="text-center py-8 text-muted-foreground">Loading report data...</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{reportData.totalSales}</div>
                  <p className="text-xs text-muted-foreground">
                    All time transactions
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${reportData.totalRevenue.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">
                    Gross sales
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
                  <TrendingUp className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">${reportData.totalProfit.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">
                    Net profit
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Products</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{reportData.productCount}</div>
                  <p className="text-xs text-muted-foreground">
                    In inventory
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Key Metrics</CardTitle>
                <CardDescription>Business performance overview</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-4 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium">Average Order Value</p>
                    <p className="text-xs text-muted-foreground">Per transaction</p>
                  </div>
                  <div className="text-2xl font-bold">${reportData.averageOrderValue.toFixed(2)}</div>
                </div>
                <div className="flex justify-between items-center p-4 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium">Profit Margin</p>
                    <p className="text-xs text-muted-foreground">Overall percentage</p>
                  </div>
                  <div className="text-2xl font-bold text-success">
                    {reportData.totalRevenue > 0 
                      ? ((reportData.totalProfit / reportData.totalRevenue) * 100).toFixed(1)
                      : 0}%
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminReports;
