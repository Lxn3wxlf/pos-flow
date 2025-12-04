import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSyncEngine } from '@/hooks/useSyncEngine';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { db, LocalProduct, initDatabase, resetDatabase as resetDb } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Search, Wifi, WifiOff, LogOut, Trash2, Plus, Minus, Package, Keyboard, Eye } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import AppHeader from '@/components/AppHeader';
import { EODSubmissionDialog } from '@/components/EODSubmissionDialog';
import ModifierSelector, { SelectedModifier } from '@/components/ModifierSelector';
import NumberPadDialog from '@/components/NumberPadDialog';
import SearchKeypad from '@/components/SearchKeypad';
import PrintPreviewDialog from '@/components/PrintPreviewDialog';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/casbah-logo.svg';
import { printOrder, PrintOrderData, PrintItem } from '@/lib/printService';

interface CartItem {
  product: LocalProduct;
  qty: number;
  weight_amount?: number;
  weight_unit?: string;
  modifiers?: SelectedModifier[];
  price_adjustment?: number;
}

// Menu category order matching physical menu
const MENU_CATEGORY_ORDER = [
  'Breakfast',
  'Midweek Specials',
  'Combos',
  'Family Meal',
  'Kids',
  'Mexican',
  'Mr Beasley',
  'On The Go Meals',
  'Loaded Fries',
  'Casbah Famous Sandwiches',
  'Sandwiches',
  'Burgers & Sandwiches',
  'Burgers',
  'Classic Meals',
  'Grill & Platters',
  'Sides & Extras',
  'Appetizers',
  'Desserts',
  // Drinks at the end
  'Coffee',
  'Tea',
  'Cold Coffee',
  'Milk Shake',
  'Freezos',
  'Assorted Drinks',
  'Beverages',
  'Drinks',
];

// Product Button Component
interface ProductButtonProps {
  product: LocalProduct;
  onAdd: (product: LocalProduct) => void;
  hasModifiers: Set<string>;
  isLocked: boolean;
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
}

const ProductButton = ({ product, onAdd, hasModifiers, isLocked, cart, setCart }: ProductButtonProps) => {
  const handleClick = () => {
    if (product.pricing_type === 'weight_based') {
      const weight = prompt('Enter weight amount (e.g., 0.3, 0.5, 1):');
      if (weight && !isNaN(parseFloat(weight))) {
        if (hasModifiers.has(product.id)) {
          onAdd(product);
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
      onAdd(product);
    }
  };

  return (
    <Button
      variant="outline"
      className="h-auto flex-col items-start p-3 hover:bg-accent"
      onClick={handleClick}
      disabled={isLocked}
    >
      <div className="w-full aspect-square mb-2 rounded-md bg-muted flex items-center justify-center overflow-hidden">
        {product.image_url ? (
          <img 
            src={product.image_url} 
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <Package className="h-8 w-8 text-muted-foreground/40" />
        )}
      </div>
      <span className="font-semibold text-xs leading-tight line-clamp-2">{product.name}</span>
      {product.pricing_type === 'weight_based' ? (
        <span className="text-sm font-bold text-primary mt-1">
          R{product.price_per_unit?.toFixed(2)}/{product.unit_type || 'kg'}
        </span>
      ) : (
        <span className="text-sm font-bold text-primary mt-1">R{product.price.toFixed(2)}</span>
      )}
      <Badge variant="secondary" className="mt-1 text-[10px]">Stock: {product.stock_qty}</Badge>
    </Button>
  );
};

const POS = () => {
  const { user, profile, signOut } = useAuth();
  const { isOnline, isSyncing, lastSync } = useSyncEngine(user?.id);
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [cashReceived, setCashReceived] = useState<string>('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isEODOpen, setIsEODOpen] = useState(false);
  const [hasPendingEOD, setHasPendingEOD] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [modifierDialogOpen, setModifierDialogOpen] = useState(false);
  const [selectedProductForCustomization, setSelectedProductForCustomization] = useState<LocalProduct | null>(null);
  const [hasModifiers, setHasModifiers] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<{id: string, name: string}[]>([]);
  const [cashPadOpen, setCashPadOpen] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [previewOrderData, setPreviewOrderData] = useState<PrintOrderData | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);

  // Database recovery function
  const resetDatabase = async () => {
    try {
      await resetDb();
      setDbError(null);
      toast.success('Database reset successful. Refreshing...');
      window.location.reload();
    } catch (error) {
      console.error('Failed to reset database:', error);
      toast.error('Failed to reset database');
    }
  };

  // Initialize database on mount with error recovery
  useEffect(() => {
    const init = async () => {
      const success = await initDatabase();
      if (!success) {
        setDbError('Failed to initialize database. Please reset.');
      }
    };
    init();
  }, []);

  // Check for pending EOD on mount and periodically
  useEffect(() => {
    checkPendingEOD();
    const interval = setInterval(checkPendingEOD, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Load which products have modifiers and categories
  useEffect(() => {
    loadProductFeatures();
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase.from('categories').select('id, name');
      if (!error && data) {
        setCategories(data);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

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

  // Load products from IndexedDB with error handling
  const products = useLiveQuery(
    async () => {
      try {
        return await db.products.toArray();
      } catch (error) {
        console.error('Database error:', error);
        setDbError('Database error occurred. Please reset the database.');
        return [];
      }
    },
    [],
    [] // Default value to prevent crashes
  );

  // Categorize products helper
  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'Uncategorized';
    const cat = categories.find(c => c.id === categoryId);
    return cat?.name || 'Uncategorized';
  };

  // IMPORTANT: useMemo must be called before any early returns to avoid hooks order issues
  const categorizedProducts = useMemo(() => {
    if (!products) return [];
    
    const grouped: Record<string, LocalProduct[]> = {};

    products.forEach(product => {
      const categoryName = getCategoryName(product.category_id);
      
      // Filter by search query
      if (searchQuery) {
        const matches = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.barcode?.includes(searchQuery);
        if (!matches) return;
      }

      if (!grouped[categoryName]) grouped[categoryName] = [];
      grouped[categoryName].push(product);
    });

    // Sort categories by the defined order
    const sortedCategories: { category: string; items: LocalProduct[] }[] = [];
    
    // First add categories in defined order
    MENU_CATEGORY_ORDER.forEach(cat => {
      if (grouped[cat] && grouped[cat].length > 0) {
        sortedCategories.push({ category: cat, items: grouped[cat] });
        delete grouped[cat];
      }
    });
    
    // Then add any remaining categories not in the order list
    Object.entries(grouped).forEach(([cat, items]) => {
      if (items.length > 0) {
        sortedCategories.push({ category: cat, items });
      }
    });

    return sortedCategories;
  }, [products, categories, searchQuery]);

  // Redirect if not authenticated or doesn't have cashier/waiter/admin role
  if (!user) return <Navigate to="/auth" />;
  const hasAccess = profile?.roles?.some(r => ['cashier', 'waiter', 'admin'].includes(r));
  if (!hasAccess) return <Navigate to="/auth" />;

  // Show database error UI
  if (dbError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-destructive">Database Error</CardTitle>
            <CardDescription>{dbError}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The local database may be corrupted. Click below to reset it and reload the page.
            </p>
            <Button onClick={resetDatabase} variant="destructive" className="w-full">
              Reset Database
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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

      // Create order for kitchen display
      const { data: orderNumberData } = await supabase.rpc('generate_order_number');
      const orderNumber = orderNumberData || `ORD-${saleId.slice(0, 6).toUpperCase()}`;
      
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          order_type: 'takeout',
          status: 'pending',
          discount_amount: discountAmount,
        })
        .select()
        .single();

      if (orderError) {
        console.error('Error creating order:', orderError);
      }

      // Save sale items and create order items for kitchen
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

        // Create order item for kitchen display
        if (orderData) {
          const orderItemInsert = {
            order_id: orderData.id,
            product_id: item.product.id,
            product_name: item.product.name,
            product_sku: item.product.sku,
            qty: item.qty,
            price_at_order: itemPrice,
            cost_at_order: item.product.cost,
            tax_rate: item.product.tax_rate,
            line_total: itemPrice * item.qty,
            kitchen_station: (item.product.kitchen_station || 'general') as 'grill' | 'fryer' | 'salad' | 'dessert' | 'bar' | 'general',
            weight_amount: item.weight_amount,
            weight_unit: item.weight_unit,
          };
          const { data: orderItemData, error: orderItemError } = await supabase
            .from('order_items')
            .insert(orderItemInsert)
            .select()
            .single();

          // Add modifiers to order item
          if (orderItemData && item.modifiers && item.modifiers.length > 0) {
            const modifierInserts = item.modifiers.map(mod => ({
              order_item_id: orderItemData.id,
              modifier_id: mod.modifier_id,
              modifier_name: mod.modifier_name,
              price_adjustment: mod.price_adjustment,
            }));
            await supabase.from('order_item_modifiers').insert(modifierInserts);
          }
        }

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
      setCashReceived('');
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

  const printReceipt = async (saleId: string, items: CartItem[], totals: any) => {
    // Build print items with category information for routing
    const printItems: PrintItem[] = items.map(item => {
      const categoryName = getCategoryName(item.product.category_id);
      const itemPrice = getItemPrice(item);
      return {
        productName: item.product.name,
        qty: item.qty,
        weightAmount: item.weight_amount,
        weightUnit: item.weight_unit,
        modifiers: item.modifiers?.map(m => m.modifier_name),
        categoryName,
        kitchenStation: item.product.kitchen_station || 'general',
        price: itemPrice,
        lineTotal: itemPrice * item.qty,
      };
    });

    // Build order data for print service
    const orderData: PrintOrderData = {
      orderNumber: `SALE-${saleId.slice(0, 8).toUpperCase()}`,
      orderType: 'takeout', // POS counter sales default to takeout
      items: printItems,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      discountAmount: discountAmount,
      total: totals.total,
      paymentMethod: paymentMethod,
      cashierName: profile?.full_name,
      timestamp: new Date(),
    };

    // Print with multi-destination routing:
    // - Kitchen ticket for food/bar items (auto-routed based on settings)
    // - 2 receipt copies (customer + cashier/till)
    await printOrder(orderData, {
      printKitchenTicket: true,
      printReceipt: true,
      receiptCopies: 2, // Customer copy + Till reconciliation copy
    });
    
    toast.success('Order sent to kitchen & receipt printed');
  };

  const openPrintPreview = () => {
    if (cart.length === 0) {
      toast.error('Add items to cart first');
      return;
    }

    const { subtotal, taxAmount, total } = calculateTotals();
    
    const printItems: PrintItem[] = cart.map(item => {
      const categoryName = getCategoryName(item.product.category_id);
      const itemPrice = getItemPrice(item);
      return {
        productName: item.product.name,
        qty: item.qty,
        weightAmount: item.weight_amount,
        weightUnit: item.weight_unit,
        modifiers: item.modifiers?.map(m => m.modifier_name),
        categoryName,
        kitchenStation: item.product.kitchen_station || 'general',
        price: itemPrice,
        lineTotal: itemPrice * item.qty,
      };
    });

    const orderData: PrintOrderData = {
      orderNumber: `PREVIEW-${Date.now().toString(36).toUpperCase()}`,
      orderType: 'takeout',
      items: printItems,
      subtotal,
      taxAmount,
      discountAmount,
      total,
      paymentMethod,
      cashierName: profile?.full_name,
      timestamp: new Date(),
    };

    setPreviewOrderData(orderData);
    setPrintPreviewOpen(true);
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
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products by name, SKU, or barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                  disabled={isLocked}
                />
                <Button
                  variant={showKeypad ? "default" : "outline"}
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => setShowKeypad(!showKeypad)}
                  disabled={isLocked}
                >
                  <Keyboard className="h-4 w-4" />
                </Button>
              </div>
              {showKeypad && (
                <div className="animate-fade-in">
                  <SearchKeypad 
                    value={searchQuery} 
                    onChange={setSearchQuery} 
                    disabled={isLocked}
                  />
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {isLocked ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-lg font-medium">POS Locked</p>
                  <p className="text-sm">Waiting for admin to approve your End of Day report</p>
                </div>
              ) : (
                <div className="space-y-6 max-h-[60vh] overflow-y-auto">
                  {categorizedProducts.map(({ category, items }) => {
                    const isSpecial = category === 'Midweek Specials';
                    const isBreakfast = category === 'Breakfast';
                    const isCasbahFamous = category === 'Casbah Famous Sandwiches';
                    return (
                      <div key={category}>
                        <h3 className={`font-bold text-sm mb-2 sticky top-0 py-2 px-3 rounded-md uppercase tracking-wide ${
                          isCasbahFamous
                            ? 'text-red-900 dark:text-red-100 bg-gradient-to-r from-red-200 to-rose-200 dark:from-red-900/60 dark:to-rose-900/60 border border-red-400 dark:border-red-700'
                            : isBreakfast
                              ? 'text-yellow-900 dark:text-yellow-100 bg-gradient-to-r from-yellow-200 to-orange-200 dark:from-yellow-900/60 dark:to-orange-900/60 border border-yellow-400 dark:border-yellow-700'
                              : isSpecial 
                                ? 'text-amber-900 dark:text-amber-100 bg-gradient-to-r from-amber-200 to-orange-200 dark:from-amber-900/60 dark:to-orange-900/60 border border-amber-300 dark:border-amber-700' 
                                : 'text-blue-800 dark:text-blue-100 bg-blue-100 dark:bg-blue-900/50'
                        }`}>
                          {isCasbahFamous && '🔥 '}
                          {isBreakfast && '☀️ '}
                          {isSpecial && '⭐ '}
                          {category}
                          {isSpecial && ' ⭐'}
                          {isBreakfast && ' ☀️'}
                          {isCasbahFamous && ' 🔥'}
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {items.map(product => (
                            <ProductButton key={product.id} product={product} onAdd={openCustomization} hasModifiers={hasModifiers} isLocked={isLocked} cart={cart} setCart={setCart} />
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {categorizedProducts.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No products found</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cart Section */}
        <div className="space-y-3">
          <Card className="p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold">Cart</span>
              <span className="text-xs text-muted-foreground">{cart.length} items</span>
            </div>
            {cart.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">Cart is empty</p>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {cart.map(item => {
                    const itemPrice = getItemPrice(item);
                    return (
                      <div key={item.product.id} className="flex items-center gap-1.5 p-1.5 border rounded text-xs">
                        <div className="flex-1 min-w-0">
                           <p className="font-medium truncate">
                             {item.product.name}
                             {item.weight_amount && ` (${item.weight_amount}${item.weight_unit})`}
                           </p>
                           {item.modifiers && item.modifiers.length > 0 && (
                             <p className="text-[10px] text-muted-foreground truncate">
                               {item.modifiers.map(m => m.modifier_name).join(', ')}
                             </p>
                           )}
                        </div>
                        <div className="flex items-center gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5"
                            onClick={() => updateQty(item.product.id, item.qty - 1)}
                            disabled={isLocked}
                          >
                            <Minus className="h-2.5 w-2.5" />
                          </Button>
                          <span className="w-5 text-center font-medium text-xs">{item.qty}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5"
                            onClick={() => updateQty(item.product.id, item.qty + 1)}
                            disabled={isLocked}
                          >
                            <Plus className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                        <span className="font-bold text-xs w-16 text-right">R{(itemPrice * item.qty).toFixed(2)}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5 text-destructive"
                          onClick={() => removeFromCart(item.product.id)}
                          disabled={isLocked}
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>

                <Separator />

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>R{totals.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax:</span>
                    <span>R{totals.taxAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Discount:</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                      className="w-20 h-6 text-xs"
                      disabled={isLocked}
                    />
                  </div>
                  <Separator />
                  <div className="flex justify-between text-base font-bold">
                    <span>Total:</span>
                    <span>R{totals.total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">Payment Method</label>
                  <Select value={paymentMethod} onValueChange={(val) => { setPaymentMethod(val); setCashReceived(''); }} disabled={isLocked}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card (Yoco)</SelectItem>
                      <SelectItem value="capitec">Capitec Pay</SelectItem>
                      <SelectItem value="eft">EFT / Bank Transfer</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {paymentMethod === 'cash' && (
                  <div className="space-y-2 p-2 bg-muted rounded-lg text-xs">
                    <Button
                      variant="outline"
                      className="w-full h-8 justify-between text-xs"
                      onClick={() => setCashPadOpen(true)}
                      disabled={isLocked}
                    >
                      <span>Cash Received:</span>
                      <span className="font-bold">R{cashReceived || '0.00'}</span>
                    </Button>
                    {cashReceived && parseFloat(cashReceived) >= totals.total && (
                      <div className="flex justify-between items-center text-base font-bold text-green-600 dark:text-green-400">
                        <span>Change:</span>
                        <span>R{(parseFloat(cashReceived) - totals.total).toFixed(2)}</span>
                      </div>
                    )}
                    {cashReceived && parseFloat(cashReceived) > 0 && parseFloat(cashReceived) < totals.total && (
                      <div className="flex justify-between items-center text-destructive">
                        <span>Short by:</span>
                        <span>R{(totals.total - parseFloat(cashReceived)).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={openPrintPreview}
                    disabled={cart.length === 0 || isLocked}
                    className="flex-shrink-0"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button 
                    className="flex-1" 
                    size="sm"
                    onClick={completeSale}
                    disabled={cart.length === 0 || isProcessingPayment || isLocked}
                  >
                    {isProcessingPayment ? 'Processing...' : `Complete Sale (R${totals.total.toFixed(2)})`}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Number Pad Dialog */}
      <NumberPadDialog
        open={cashPadOpen}
        onClose={() => setCashPadOpen(false)}
        onConfirm={(value) => setCashReceived(value)}
        title="Enter Cash Received"
        initialValue={cashReceived}
      />

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

      {/* Print Preview Dialog */}
      <PrintPreviewDialog
        open={printPreviewOpen}
        onOpenChange={setPrintPreviewOpen}
        orderData={previewOrderData}
      />
    </div>
  );
};

export default POS;
