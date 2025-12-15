import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, CreditCard, X, AlertTriangle } from 'lucide-react';
import NumberPadDialog from './NumberPadDialog';

interface BarTab {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  spending_limit: number;
  current_total: number;
  status: string;
  opened_at: string;
  notes: string | null;
}

interface BarTabItem {
  id: string;
  product_name: string;
  qty: number;
  unit_price: number;
  line_total: number;
  added_at: string;
  notes: string | null;
}

interface CartItem {
  product: {
    id: string;
    name: string;
    price: number;
    pricing_type?: string;
    price_per_unit?: number;
  };
  qty: number;
  weight_amount?: number;
  price_adjustment?: number;
}

interface BarTabDialogProps {
  open: boolean;
  onClose: () => void;
  cart: CartItem[];
  userId: string;
  onClearCart: () => void;
}

const BarTabDialog = ({ open, onClose, cart, userId, onClearCart }: BarTabDialogProps) => {
  const [tabs, setTabs] = useState<BarTab[]>([]);
  const [selectedTab, setSelectedTab] = useState<BarTab | null>(null);
  const [tabItems, setTabItems] = useState<BarTabItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);
  
  // New tab form
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newSpendingLimit, setNewSpendingLimit] = useState('');
  const [limitPadOpen, setLimitPadOpen] = useState(false);

  useEffect(() => {
    if (open) {
      loadTabs();
    }
  }, [open]);

  useEffect(() => {
    if (selectedTab) {
      loadTabItems(selectedTab.id);
    }
  }, [selectedTab]);

  const loadTabs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bar_tabs')
        .select('*')
        .eq('status', 'open')
        .order('opened_at', { ascending: false });

      if (error) throw error;
      setTabs(data || []);
    } catch (error) {
      console.error('Error loading tabs:', error);
      toast.error('Failed to load tabs');
    } finally {
      setLoading(false);
    }
  };

  const loadTabItems = async (tabId: string) => {
    try {
      const { data, error } = await supabase
        .from('bar_tab_items')
        .select('*')
        .eq('tab_id', tabId)
        .order('added_at', { ascending: true });

      if (error) throw error;
      setTabItems(data || []);
    } catch (error) {
      console.error('Error loading tab items:', error);
    }
  };

  const createNewTab = async () => {
    if (!newCustomerName.trim()) {
      toast.error('Customer name is required');
      return;
    }
    if (!newSpendingLimit || parseFloat(newSpendingLimit) <= 0) {
      toast.error('Spending limit must be greater than R0');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bar_tabs')
        .insert({
          customer_name: newCustomerName.trim(),
          customer_phone: newCustomerPhone.trim() || null,
          spending_limit: parseFloat(newSpendingLimit),
          opened_by: userId,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`Tab opened for ${newCustomerName}`);
      setCreatingNew(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      setNewSpendingLimit('');
      loadTabs();
      setSelectedTab(data);
    } catch (error) {
      console.error('Error creating tab:', error);
      toast.error('Failed to create tab');
    } finally {
      setLoading(false);
    }
  };

  const addCartToTab = async () => {
    if (!selectedTab) return;
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    // Calculate cart total
    const cartTotal = cart.reduce((sum, item) => {
      let price = item.product.price;
      if (item.product.pricing_type === 'weight_based' && item.weight_amount && item.product.price_per_unit) {
        price = item.product.price_per_unit * item.weight_amount;
      }
      return sum + ((price + (item.price_adjustment || 0)) * item.qty);
    }, 0);

    const newTotal = selectedTab.current_total + cartTotal;
    
    if (newTotal > selectedTab.spending_limit) {
      toast.error(`Adding these items would exceed the tab limit of R${selectedTab.spending_limit.toFixed(2)}. Current: R${selectedTab.current_total.toFixed(2)}, Adding: R${cartTotal.toFixed(2)}`);
      return;
    }

    setLoading(true);
    try {
      // Insert items
      const items = cart.map(item => {
        let unitPrice = item.product.price;
        if (item.product.pricing_type === 'weight_based' && item.weight_amount && item.product.price_per_unit) {
          unitPrice = item.product.price_per_unit * item.weight_amount;
        }
        unitPrice += item.price_adjustment || 0;

        return {
          tab_id: selectedTab.id,
          product_id: item.product.id,
          product_name: item.product.name,
          qty: item.qty,
          unit_price: unitPrice,
          line_total: unitPrice * item.qty,
          added_by: userId,
        };
      });

      const { error: insertError } = await supabase
        .from('bar_tab_items')
        .insert(items);

      if (insertError) throw insertError;

      // Update tab total
      const { error: updateError } = await supabase
        .from('bar_tabs')
        .update({ current_total: newTotal })
        .eq('id', selectedTab.id);

      if (updateError) throw updateError;

      toast.success(`Added ${cart.length} item(s) to ${selectedTab.customer_name}'s tab`);
      setSelectedTab({ ...selectedTab, current_total: newTotal });
      loadTabItems(selectedTab.id);
      onClearCart();
    } catch (error) {
      console.error('Error adding to tab:', error);
      toast.error('Failed to add items to tab');
    } finally {
      setLoading(false);
    }
  };

  const settleTab = async () => {
    if (!selectedTab) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('bar_tabs')
        .update({
          status: 'settled',
          closed_at: new Date().toISOString(),
          closed_by: userId,
        })
        .eq('id', selectedTab.id);

      if (error) throw error;

      toast.success(`Tab settled for R${selectedTab.current_total.toFixed(2)}`);
      setSelectedTab(null);
      setTabItems([]);
      loadTabs();
    } catch (error) {
      console.error('Error settling tab:', error);
      toast.error('Failed to settle tab');
    } finally {
      setLoading(false);
    }
  };

  const cancelTab = async () => {
    if (!selectedTab) return;

    if (!confirm(`Cancel ${selectedTab.customer_name}'s tab? This cannot be undone.`)) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('bar_tabs')
        .update({
          status: 'cancelled',
          closed_at: new Date().toISOString(),
          closed_by: userId,
        })
        .eq('id', selectedTab.id);

      if (error) throw error;

      toast.success('Tab cancelled');
      setSelectedTab(null);
      setTabItems([]);
      loadTabs();
    } catch (error) {
      console.error('Error cancelling tab:', error);
      toast.error('Failed to cancel tab');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  };

  const remainingLimit = selectedTab ? selectedTab.spending_limit - selectedTab.current_total : 0;
  const limitPercentUsed = selectedTab ? (selectedTab.current_total / selectedTab.spending_limit) * 100 : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Bar Tabs
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 grid grid-cols-2 gap-4">
            {/* Left: Tab List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Open Tabs</h3>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setCreatingNew(true)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  New Tab
                </Button>
              </div>

              {creatingNew && (
                <div className="p-3 border rounded-lg space-y-2 bg-muted/50">
                  <Input
                    placeholder="Customer name *"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Input
                    placeholder="Phone (optional)"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <div className="flex gap-2">
                    <div 
                      className="flex-1 h-8 px-3 text-sm border rounded-md flex items-center cursor-pointer hover:bg-accent"
                      onClick={() => setLimitPadOpen(true)}
                    >
                      {newSpendingLimit ? `R${parseFloat(newSpendingLimit).toFixed(2)}` : 'Set Limit *'}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 h-7 text-xs" onClick={createNewTab} disabled={loading}>
                      Create
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCreatingNew(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              <ScrollArea className="h-[300px]">
                {loading && tabs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
                ) : tabs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No open tabs</p>
                ) : (
                  <div className="space-y-2 pr-2">
                    {tabs.map(tab => (
                      <div
                        key={tab.id}
                        className={`p-2 border rounded-lg cursor-pointer transition-colors ${
                          selectedTab?.id === tab.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                        }`}
                        onClick={() => setSelectedTab(tab)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{tab.customer_name}</span>
                          <span className="text-xs text-muted-foreground">{formatTime(tab.opened_at)}</span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-muted-foreground">
                            R{tab.current_total.toFixed(2)} / R{tab.spending_limit.toFixed(2)}
                          </span>
                          {tab.current_total >= tab.spending_limit * 0.8 && (
                            <Badge variant="destructive" className="text-[10px] h-4">
                              {tab.current_total >= tab.spending_limit ? 'LIMIT REACHED' : 'NEAR LIMIT'}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all ${
                              tab.current_total >= tab.spending_limit ? 'bg-destructive' 
                              : tab.current_total >= tab.spending_limit * 0.8 ? 'bg-yellow-500' 
                              : 'bg-primary'
                            }`}
                            style={{ width: `${Math.min((tab.current_total / tab.spending_limit) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Right: Tab Details */}
            <div className="space-y-2">
              {selectedTab ? (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{selectedTab.customer_name}</h3>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setSelectedTab(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Limit indicator */}
                  <div className="p-2 rounded-lg bg-muted/50 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Spent</span>
                      <span className="font-medium">R{selectedTab.current_total.toFixed(2)}</span>
                    </div>
                    <div className="h-2 bg-background rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${
                          limitPercentUsed >= 100 ? 'bg-destructive' 
                          : limitPercentUsed >= 80 ? 'bg-yellow-500' 
                          : 'bg-primary'
                        }`}
                        style={{ width: `${Math.min(limitPercentUsed, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Remaining: R{remainingLimit.toFixed(2)}</span>
                      <span>Limit: R{selectedTab.spending_limit.toFixed(2)}</span>
                    </div>
                    {limitPercentUsed >= 80 && (
                      <div className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
                        <AlertTriangle className="h-3 w-3" />
                        <span>{limitPercentUsed >= 100 ? 'Limit reached!' : 'Approaching limit'}</span>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Tab items */}
                  <ScrollArea className="h-[180px]">
                    {tabItems.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No items yet</p>
                    ) : (
                      <div className="space-y-1 pr-2">
                        {tabItems.map(item => (
                          <div key={item.id} className="flex items-center justify-between text-xs p-1.5 bg-muted/30 rounded">
                            <span className="flex-1 truncate">{item.qty}x {item.product_name}</span>
                            <span className="font-medium">R{item.line_total.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>

                  <Separator />

                  {/* Actions */}
                  <div className="space-y-2">
                    {cart.length > 0 && (
                      <Button 
                        className="w-full h-8 text-xs" 
                        onClick={addCartToTab}
                        disabled={loading || selectedTab.current_total >= selectedTab.spending_limit}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Cart to Tab (R{cart.reduce((sum, item) => sum + (item.product.price + (item.price_adjustment || 0)) * item.qty, 0).toFixed(2)})
                      </Button>
                    )}
                    <div className="flex gap-2">
                      <Button 
                        variant="default" 
                        className="flex-1 h-8 text-xs"
                        onClick={settleTab}
                        disabled={loading || selectedTab.current_total === 0}
                      >
                        <CreditCard className="h-3 w-3 mr-1" />
                        Settle (R{selectedTab.current_total.toFixed(2)})
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        className="h-8 text-xs"
                        onClick={cancelTab}
                        disabled={loading}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Select a tab or create a new one
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <NumberPadDialog
        open={limitPadOpen}
        onClose={() => setLimitPadOpen(false)}
        onConfirm={(value) => setNewSpendingLimit(value)}
        title="Set Spending Limit"
        initialValue={newSpendingLimit}
      />
    </>
  );
};

export default BarTabDialog;
