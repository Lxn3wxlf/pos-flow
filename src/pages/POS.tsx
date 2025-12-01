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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Search, Wifi, WifiOff, LogOut, Trash2, Plus, Minus, Package } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import AppHeader from '@/components/AppHeader';
import { EODSubmissionDialog } from '@/components/EODSubmissionDialog';
import ModifierSelector, { SelectedModifier } from '@/components/ModifierSelector';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/casbah-logo.svg';

interface CartItem {
  product: LocalProduct;
  qty: number;
  weight_amount?: number;
  weight_unit?: string;
  modifiers?: SelectedModifier[];
  price_adjustment?: number;
}

const POS = () => {
  const { user, profile, signOut } = useAuth();
  const { isOnline, isSyncing, lastSync } = useSyncEngine(user?.id);
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isEODOpen, setIsEODOpen] = useState(false);
  const [hasPendingEOD, setHasPendingEOD] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [modifierDialogOpen, setModifierDialogOpen] = useState(false);
  const [selectedProductForCustomization, setSelectedProductForCustomization] = useState<LocalProduct | null>(null);
  const [hasModifiers, setHasModifiers] = useState<Set<string>>(new Set());

  // Check for pending EOD on mount and periodically
  useEffect(() => {
    checkPendingEOD();
    const interval = setInterval(checkPendingEOD, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [user]);

  // Load which products have modifiers
  useEffect(() => {
    loadProductFeatures();
  }, []);

  const loadProductFeatures = async () => {
    try {
      const { data, error } = await supabase
        .from('product_modifiers')
        .select('product_id');
      
      if (!error && data) {
        setHasModifiers(new Set(data.map(pm => pm.product_id)));
      }
    } catch (error) {
      console.error('Error loading product features:', error);
    }
  };

  const checkPendingEOD = async () => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('eod_sessions')
      .select('status')
      .eq('cashier_id', user.id)
      .eq('shift_date', today)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking EOD:', error);
      return;
    }

    if (data) {
      setHasPendingEOD(true);
      setIsLocked(data.status === 'pending');
    } else {
      setHasPendingEOD(false);
      setIsLocked(false);
    }
  };

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

  const openCustomization = (product: LocalProduct) => {
    if (isLocked) {
      toast.error("POS is locked pending EOD approval");
      return;
    }

    setSelectedProductForCustomization(product);
    
    if (hasModifiers.has(product.id)) {
      setModifierDialogOpen(true);
    } else {
      addItemDirectly(product);
    }
  };

  const addItemDirectly = (product: LocalProduct, modifiers?: SelectedModifier[]) => {
    const priceAdjustment = modifiers?.reduce((sum, m) => sum + m.price_adjustment, 0) || 0;
    
    const existing = cart.find(item => 
      item.product.id === product.id && 
      JSON.stringify(item.modifiers || []) === JSON.stringify(modifiers || [])
    );
    
    if (existing) {
      setCart(cart.map(item =>
        item.product.id === product.id && 
        JSON.stringify(item.modifiers || []) === JSON.stringify(modifiers || [])
          ? { ...item, qty: item.qty + 1 }
          : item
      ));
    } else {
      setCart([...cart, { 
        product, 
        qty: 1,
        modifiers: modifiers || [],
        price_adjustment: priceAdjustment
      }]);
    }
    toast.success(`Added ${product.name} to cart`);
  };

  const handleModifierConfirm = (modifiers: SelectedModifier[], totalAdjustment: number) => {
    if (selectedProductForCustomization) {
      addItemDirectly(selectedProductForCustomization, modifiers);
    }
    setSelectedProductForCustomization(null);
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

  const getItemPrice = (item: CartItem) => {
    let basePrice = item.product.price;
    if (item.product.pricing_type === 'weight_based' && item.weight_amount && item.product.price_per_unit) {
      basePrice = item.product.price_per_unit * item.weight_amount;
    }
    return basePrice + (item.price_adjustment || 0);
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + (getItemPrice(item) * item.qty), 0);
    const taxAmount = cart.reduce((sum, item) => 
      sum + (getItemPrice(item) * item.qty * item.product.tax_rate / 100), 0
    );
    const total = subtotal + taxAmount - discountAmount;
    return { subtotal, taxAmount, total };
  };

  const processYocoPayment = async (saleId: string, amount: number) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-yoco-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          amount,
          currency: 'ZAR',
          sale_id: saleId,
          metadata: {
            cashier_id: user!.id,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Payment processing failed');
      }

      return data;
    } catch (error) {
      console.error('Yoco payment error:', error);
      throw error;
    }
  };

  const completeSale = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    if (isLocked) {
      toast.error("POS is locked pending EOD approval");
      return;
    }

    const { subtotal, taxAmount, total } = calculateTotals();

    if (total < 0) {
      toast.error('Total cannot be negative');
      return;
    }

    setIsProcessingPayment(true);

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

      // Process Yoco payment if card payment is selected
      if (paymentMethod === 'card') {
        try {
          await processYocoPayment(saleId, total);
          toast.success('Card payment processed successfully');
        } catch (error) {
          toast.error('Card payment failed. Please try again or use another payment method.');
          setIsProcessingPayment(false);
          return;
        }
      }

      // Save sale items
      for (const item of cart) {
        const itemPrice = getItemPrice(item);
        await db.sale_items.add({
          id: crypto.randomUUID(),
          sale_id: saleId,
          product_id: item.product.id,
          product_name: item.product.name,
          product_sku: item.product.sku,
          qty: item.qty,
          price_at_sale: itemPrice,
          cost_at_sale: item.product.cost,
          tax_rate: item.product.tax_rate,
          line_total: itemPrice * item.qty
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
    } finally {
      setIsProcessingPayment(false);
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
        ${items.map(item => {
          const itemPrice = getItemPrice(item);
          const weightInfo = item.weight_amount ? ` (${item.weight_amount}${item.weight_unit})` : '';
          return `
            <div class="item">
              <span>${item.product.name}${weightInfo} x${item.qty}</span>
              <span>R${(itemPrice * item.qty).toFixed(2)}</span>
            </div>
          `;
        }).join('')}
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
      <AppHeader>
        <div className="flex items-center gap-3">
          <img 
            src={logo} 
            alt="Casbah Logo" 
            className="h-8 w-auto cursor-pointer hover:opacity-80 transition-opacity" 
            onClick={() => navigate('/admin')}
          />
          <div className="text-left">
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
          <Button variant="ghost" size="sm" onClick={() => setIsEODOpen(true)} disabled={hasPendingEOD || isLocked}>
            <LogOut className="h-4 w-4 mr-2" />
            End of Day
          </Button>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </AppHeader>

      {isLocked && (
        <Alert className="m-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <AlertDescription className="text-yellow-900 dark:text-yellow-100 font-medium">
            ⚠️ POS is locked. Your End of Day report is pending admin approval.
          </AlertDescription>
        </Alert>
      )}

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
                  disabled={isLocked}
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLocked ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-lg font-medium">POS Locked</p>
                  <p className="text-sm">Waiting for admin to approve your End of Day report</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {filteredProducts?.map(product => (
                    <Button
                      key={product.id}
                      variant="outline"
                      className="h-auto flex-col items-start p-4 hover:bg-accent"
                      onClick={() => {
                        if (product.pricing_type === 'weight_based') {
                          const weight = prompt('Enter weight amount (e.g., 0.3, 0.5, 1):');
                          if (weight && !isNaN(parseFloat(weight))) {
                            setSelectedProductForCustomization(product);
                            if (hasModifiers.has(product.id)) {
                              setModifierDialogOpen(true);
                              // Store weight info temporarily to add after modifier selection
                              (product as any).tempWeight = parseFloat(weight);
                              (product as any).tempUnit = product.unit_type || 'kg';
                            } else {
                              setCart([...cart, { 
                                product, 
                                qty: 1, 
                                weight_amount: parseFloat(weight),
                                weight_unit: product.unit_type || 'kg'
                              }]);
                              toast.success(`Added ${product.name} to cart`);
                            }
                          }
                        } else {
                          openCustomization(product);
                        }
                      }}
                      disabled={isLocked}
                    >
                      <div className="w-full aspect-square mb-3 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                        {product.image_url ? (
                          <img 
                            src={product.image_url} 
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="h-12 w-12 text-muted-foreground/40" />
                        )}
                      </div>
                      <span className="font-semibold text-sm">{product.name}</span>
                      <span className="text-xs text-muted-foreground">{product.sku}</span>
                      {product.pricing_type === 'weight_based' ? (
                        <span className="text-lg font-bold text-primary mt-2">
                          R{product.price_per_unit?.toFixed(2)}/{product.unit_type || 'kg'}
                        </span>
                      ) : (
                        <span className="text-lg font-bold text-primary mt-2">R{product.price.toFixed(2)}</span>
                      )}
                      <Badge variant="secondary" className="mt-1">Stock: {product.stock_qty}</Badge>
                    </Button>
                  ))}
                </div>
              )}
              {filteredProducts?.length === 0 && !isLocked && (
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
                    {cart.map(item => {
                      const itemPrice = getItemPrice(item);
                      return (
                        <div key={item.product.id} className="flex items-center gap-2 p-2 border rounded">
                          <div className="flex-1">
                             <p className="font-medium text-sm">
                               {item.product.name}
                               {item.weight_amount && ` (${item.weight_amount}${item.weight_unit})`}
                             </p>
                             {item.modifiers && item.modifiers.length > 0 && (
                               <p className="text-xs text-muted-foreground">
                                 {item.modifiers.map(m => m.modifier_name).join(', ')}
                               </p>
                             )}
                             <p className="text-xs text-muted-foreground">R{itemPrice.toFixed(2)} each</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => updateQty(item.product.id, item.qty - 1)}
                              disabled={isLocked}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center font-medium">{item.qty}</span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => updateQty(item.product.id, item.qty + 1)}
                              disabled={isLocked}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">R{(itemPrice * item.qty).toFixed(2)}</p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-destructive"
                            onClick={() => removeFromCart(item.product.id)}
                            disabled={isLocked}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      );
                    })}
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
                        disabled={isLocked}
                      />
                    </div>
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total:</span>
                      <span>R{totals.total.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Payment Method</label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={isLocked}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card (Yoco)</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={completeSale}
                    disabled={cart.length === 0 || isProcessingPayment || isLocked}
                  >
                    {isProcessingPayment ? 'Processing...' : `Complete Sale (R${totals.total.toFixed(2)})`}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* EOD Dialog */}
      <EODSubmissionDialog
        open={isEODOpen}
        onOpenChange={setIsEODOpen}
        onSubmitted={checkPendingEOD}
      />

      {/* Modifier Selection Dialog */}
      {selectedProductForCustomization && (
        <ModifierSelector
          productId={selectedProductForCustomization.id}
          open={modifierDialogOpen}
          onClose={() => {
            setModifierDialogOpen(false);
            setSelectedProductForCustomization(null);
          }}
          onConfirm={handleModifierConfirm}
        />
      )}
    </div>
  );
};

export default POS;
