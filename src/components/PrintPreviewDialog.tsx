import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Printer, ChefHat, Receipt, X } from 'lucide-react';
import { 
  PrintOrderData, 
  generateKitchenTicket, 
  generateReceipt, 
  filterKitchenItems,
  fetchPrintSettings,
  printOrder
} from '@/lib/printService';
import { toast } from 'sonner';

interface PrintPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderData: PrintOrderData | null;
}

const PrintPreviewDialog = ({ open, onOpenChange, orderData }: PrintPreviewDialogProps) => {
  const [activeTab, setActiveTab] = useState<'kitchen' | 'receipt'>('kitchen');
  const [printing, setPrinting] = useState(false);
  const [kitchenHtml, setKitchenHtml] = useState('');
  const [receiptHtml, setReceiptHtml] = useState('');
  const [hasKitchenItems, setHasKitchenItems] = useState(false);

  // Generate preview content when dialog opens
  const generatePreviews = async () => {
    if (!orderData) return;
    
    try {
      const { printers, routes, branding } = await fetchPrintSettings();
      const kitchenItems = filterKitchenItems(orderData.items, routes, printers);
      
      setHasKitchenItems(kitchenItems.length > 0);
      
      if (kitchenItems.length > 0) {
        setKitchenHtml(generateKitchenTicket(orderData, kitchenItems));
      }
      
      setReceiptHtml(generateReceipt(orderData, branding));
    } catch (error) {
      console.error('Failed to generate previews:', error);
    }
  };

  // Handle dialog open state change
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && orderData) {
      generatePreviews();
    }
    onOpenChange(isOpen);
  };

  const handlePrint = async (type: 'kitchen' | 'receipt' | 'both') => {
    if (!orderData) return;
    
    setPrinting(true);
    try {
      await printOrder(orderData, {
        printKitchenTicket: type === 'kitchen' || type === 'both',
        printReceipt: type === 'receipt' || type === 'both',
        receiptCopies: 2
      });
      toast.success(`Print job sent: ${type === 'both' ? 'Kitchen + Receipt' : type}`);
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Print failed: ' + (error.message || 'Unknown error'));
    } finally {
      setPrinting(false);
    }
  };

  if (!orderData) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Print Preview
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'kitchen' | 'receipt')} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="kitchen" className="gap-2" disabled={!hasKitchenItems}>
              <ChefHat className="h-4 w-4" />
              Kitchen Ticket
              {!hasKitchenItems && <span className="text-xs text-muted-foreground">(No items)</span>}
            </TabsTrigger>
            <TabsTrigger value="receipt" className="gap-2">
              <Receipt className="h-4 w-4" />
              Customer Receipt
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto mt-4 border rounded-lg bg-muted/30 p-4">
            <TabsContent value="kitchen" className="mt-0 flex justify-center">
              {hasKitchenItems ? (
                <div 
                  className="bg-white shadow-lg rounded overflow-hidden"
                  dangerouslySetInnerHTML={{ __html: kitchenHtml }}
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <ChefHat className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No kitchen items in this order</p>
                  <p className="text-sm">Only food items are sent to the kitchen printer</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="receipt" className="mt-0 flex justify-center">
              <div 
                className="bg-white shadow-lg rounded overflow-hidden"
                dangerouslySetInnerHTML={{ __html: receiptHtml }}
              />
            </TabsContent>
          </div>
        </Tabs>

        {/* Print Actions */}
        <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => handlePrint('kitchen')}
            disabled={printing || !hasKitchenItems}
            className="flex-1"
          >
            <ChefHat className="h-4 w-4 mr-2" />
            Print Kitchen Only
          </Button>
          <Button
            variant="outline"
            onClick={() => handlePrint('receipt')}
            disabled={printing}
            className="flex-1"
          >
            <Receipt className="h-4 w-4 mr-2" />
            Print Receipt Only
          </Button>
          <Button
            onClick={() => handlePrint('both')}
            disabled={printing}
            className="flex-1"
          >
            <Printer className="h-4 w-4 mr-2" />
            {printing ? 'Printing...' : 'Print Both'}
          </Button>
        </div>

        {/* Paper size info */}
        <p className="text-xs text-muted-foreground text-center">
          Paper size: 80mm × 210mm (72.1mm printable width) • Kitchen prints first, then receipt
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default PrintPreviewDialog;
