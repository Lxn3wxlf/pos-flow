import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSyncEngine } from '@/hooks/useSyncEngine';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { db, LocalProduct } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Search, ShoppingCart, Wifi, WifiOff, LogOut, Trash2, Plus, Minus } from 'lucide-react';
import { Navigate } from 'react-router-dom';

interface CartItem {
  product: LocalProduct;
  qty: number;
}

const POS = () => {
  const { user, profile, signOut } = useAuth();
  const { isOnline, isSyncing, lastSync } = useSyncEngine(user?.id);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [discountAmount, setDiscountAmount] = useState(0);

  // Load products from IndexedDB
  const products = useLiveQuery(
    () => db.products.toArray(),
    []
  );

  // Redirect if not authenticated or doesn't have cashier/waiter/admin role
  if (!user) return <Navigate to="/auth" />;
  const hasAccess = profile?.roles?.some(r => ['cashier', 'waiter', 'admin'].includes(r));
  if (!hasAccess) return <Navigate to="/auth" />;

  const filteredProducts = products?.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.barcode?.includes(searchQuery)
  ).slice(0, 20);

  const addToCart = (product: LocalProduct) => {
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      setCart(cart.map(item =>
        item.product.id === product.id
          ? { ...item, qty: item.qty + 1 }
          : item
      ));
    } else {
      setCart([...cart, { product, qty: 1 }]);
    }
    toast.success(`Added ${product.name} to cart`);
  };

  const updateQty = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(cart.map(item =>
      item.product.id === productId ? { ...item, qty: newQty } : item
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.qty), 0);
    const taxAmount = cart.reduce((sum, item) => 
      sum + (item.product.price * item.qty * item.product.tax_rate / 100), 0
    );
    const total = subtotal + taxAmount - discountAmount;
    return { subtotal, taxAmount, total };
  };

  const completeSale = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    const { subtotal, taxAmount, total } = calculateTotals();

    if (total < 0) {
      toast.error('Total cannot be negative');
      return;
    }

    try {
      const saleId = crypto.randomUUID();
      const now = new Date();

      // Save sale to IndexedDB
      await db.sales.add({
        id: saleId,
        cashier_id: user!.id,
        subtotal,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        total,
        payment_method: paymentMethod,
        created_at: now,
        synced: false,
        sync_attempts: 0
      });

      // Save sale items
      for (const item of cart) {
        await db.sale_items.add({
          id: crypto.randomUUID(),
          sale_id: saleId,
          product_id: item.product.id,
          product_name: item.product.name,
          product_sku: item.product.sku,
          qty: item.qty,
          price_at_sale: item.product.price,
          cost_at_sale: item.product.cost,
          tax_rate: item.product.tax_rate,
          line_total: item.product.price * item.qty
        });

        // Update local stock
        const currentProduct = await db.products.get(item.product.id);
        if (currentProduct) {
          await db.products.update(item.product.id, {
            stock_qty: Math.max(0, currentProduct.stock_qty - item.qty)
          });
        }
      }

      toast.success('Sale completed successfully!');
      
      // Clear cart
      setCart([]);
      setDiscountAmount(0);
      setPaymentMethod('cash');

      // Print receipt
      printReceipt(saleId, cart, { subtotal, taxAmount, total });
    } catch (error) {
      console.error('Error completing sale:', error);
      toast.error('Failed to complete sale');
    }
  };

  const printReceipt = (saleId: string, items: CartItem[], totals: any) => {
    const receiptWindow = window.open('', '_blank');
    if (!receiptWindow) return;

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${saleId}</title>
        <style>
          body { font-family: monospace; max-width: 300px; margin: 20px auto; }
          .center { text-align: center; }
          .line { border-bottom: 1px dashed #000; margin: 10px 0; }
          .item { display: flex; justify-content: space-between; margin: 5px 0; }
          .totals { margin-top: 10px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="center">
          <h2>POS System</h2>
          <p>Receipt #${saleId.split('-')[0]}</p>
          <p>${new Date().toLocaleString()}</p>
        </div>
        <div class="line"></div>
        ${items.map(item => `
          <div class="item">
            <span>${item.product.name} x${item.qty}</span>
            <span>R${(item.product.price * item.qty).toFixed(2)}</span>
          </div>
        `).join('')}
        <div class="line"></div>
        <div class="totals">
          <div class="item">
            <span>Subtotal:</span>
            <span>R${totals.subtotal.toFixed(2)}</span>
          </div>
          <div class="item">
            <span>Tax:</span>
            <span>R${totals.taxAmount.toFixed(2)}</span>
          </div>
          ${discountAmount > 0 ? `
            <div class="item">
              <span>Discount:</span>
              <span>-R${discountAmount.toFixed(2)}</span>
            </div>
          ` : ''}
          <div class="item">
            <span>Total:</span>
            <span>R${totals.total.toFixed(2)}</span>
          </div>
        </div>
        <div class="center" style="margin-top: 20px;">
          <p>Thank you for your purchase!</p>
        </div>
        <script>
          window.onload = () => {
            window.print();
            setTimeout(() => window.close(), 500);
          };
        </script>
      </body>
      </html>
    `;

    receiptWindow.document.write(receiptHtml);
    receiptWindow.document.close();
  };

  const totals = calculateTotals();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <ShoppingCart className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">POS Register</h1>
              <p className="text-sm text-muted-foreground">{profile?.full_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isOnline ? "default" : "destructive"} className="gap-1">
              {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {isOnline ? 'Online' : 'Offline'}
            </Badge>
            {isSyncing && <Badge variant="secondary">Syncing...</Badge>}
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        {/* Products Section */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products by name, SKU, or barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {filteredProducts?.map(product => (
                  <Button
                    key={product.id}
                    variant="outline"
                    className="h-auto flex-col items-start p-4 hover:bg-accent"
                    onClick={() => addToCart(product)}
                  >
                    <span className="font-semibold text-sm">{product.name}</span>
                    <span className="text-xs text-muted-foreground">{product.sku}</span>
                    <span className="text-lg font-bold text-primary mt-2">R{product.price.toFixed(2)}</span>
                    <Badge variant="secondary" className="mt-1">Stock: {product.stock_qty}</Badge>
                  </Button>
                ))}
              </div>
              {filteredProducts?.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No products found</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cart Section */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cart</CardTitle>
              <CardDescription>{cart.length} items</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Cart is empty</p>
              ) : (
                <>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {cart.map(item => (
                      <div key={item.product.id} className="flex items-center gap-2 p-2 border rounded">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.product.name}</p>
                          <p className="text-xs text-muted-foreground">R{item.product.price.toFixed(2)} each</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => updateQty(item.product.id, item.qty - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-medium">{item.qty}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => updateQty(item.product.id, item.qty + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">R{(item.product.price * item.qty).toFixed(2)}</p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-destructive"
                          onClick={() => removeFromCart(item.product.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal:</span>
                      <span>R{totals.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Tax:</span>
                      <span>R{totals.taxAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Discount:</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                        className="w-24 h-8"
                      />
                    </div>
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total:</span>
                      <span className="text-primary">R{totals.total.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Payment Method</label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="mobile">Mobile Payment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={completeSale}
                    className="w-full"
                    size="lg"
                  >
                    Complete Sale
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default POS;
