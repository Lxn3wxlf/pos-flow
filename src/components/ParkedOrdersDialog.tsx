import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Trash2, Upload, Save } from 'lucide-react';
import { toast } from 'sonner';

export interface ParkedOrder {
  tableNumber: string;
  cart: any[];
  savedAt: string;
  total: number;
}

interface ParkedOrdersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCart: any[];
  onLoadOrder: (cart: any[]) => void;
  getItemPrice: (item: any) => number;
}

const STORAGE_KEY = 'casbah_parked_orders';

export function getParkedOrders(): Record<string, ParkedOrder> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function saveParkedOrder(tableNumber: string, cart: any[], total: number): void {
  const orders = getParkedOrders();
  orders[tableNumber] = {
    tableNumber,
    cart,
    savedAt: new Date().toISOString(),
    total,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

export function deleteParkedOrder(tableNumber: string): void {
  const orders = getParkedOrders();
  delete orders[tableNumber];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

export function getParkedOrdersCount(): number {
  return Object.keys(getParkedOrders()).length;
}

export default function ParkedOrdersDialog({
  open,
  onOpenChange,
  currentCart,
  onLoadOrder,
  getItemPrice,
}: ParkedOrdersDialogProps) {
  const [tableNumber, setTableNumber] = useState('');
  const [parkedOrders, setParkedOrders] = useState<Record<string, ParkedOrder>>({});

  useEffect(() => {
    if (open) {
      setParkedOrders(getParkedOrders());
    }
  }, [open]);

  const calculateTotal = () => {
    return currentCart.reduce((sum, item) => sum + (getItemPrice(item) * item.qty), 0);
  };

  const handleSaveOrder = () => {
    if (!tableNumber.trim()) {
      toast.error('Please enter a table number');
      return;
    }

    if (currentCart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    const total = calculateTotal();
    saveParkedOrder(tableNumber.trim(), currentCart, total);
    setParkedOrders(getParkedOrders());
    toast.success(`Order saved to Table ${tableNumber}`);
    setTableNumber('');
  };

  const handleLoadOrder = (order: ParkedOrder) => {
    onLoadOrder(order.cart);
    deleteParkedOrder(order.tableNumber);
    setParkedOrders(getParkedOrders());
    toast.success(`Loaded order from Table ${order.tableNumber}`);
    onOpenChange(false);
  };

  const handleDeleteOrder = (tableNum: string) => {
    deleteParkedOrder(tableNum);
    setParkedOrders(getParkedOrders());
    toast.success(`Deleted order from Table ${tableNum}`);
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  };

  const sortedOrders = Object.values(parkedOrders).sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Parked Orders / Tables</DialogTitle>
        </DialogHeader>

        {/* Save Current Order */}
        <div className="space-y-3 border-b pb-4">
          <p className="text-sm font-medium">Save Current Cart to Table</p>
          <div className="flex gap-2">
            <Input
              placeholder="Table number (e.g., 1, A1)"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleSaveOrder} disabled={currentCart.length === 0}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
          {currentCart.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {currentCart.length} items · R{calculateTotal().toFixed(2)}
            </p>
          )}
        </div>

        {/* Saved Orders */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Saved Tables ({sortedOrders.length})</p>
          
          {sortedOrders.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">
              No parked orders
            </p>
          ) : (
            <ScrollArea className="h-[250px]">
              <div className="space-y-2 pr-2">
                {sortedOrders.map((order) => (
                  <div
                    key={order.tableNumber}
                    className="flex items-center justify-between p-3 border rounded-lg bg-card"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-sm font-bold">
                          Table {order.tableNumber}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(order.savedAt)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {order.cart.length} items · R{order.total.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleLoadOrder(order)}
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        Load
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteOrder(order.tableNumber)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
