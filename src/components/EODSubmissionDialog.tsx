import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface EODSubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: () => void;
}

export function EODSubmissionDialog({ open, onOpenChange, onSubmitted }: EODSubmissionDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [actualCash, setActualCash] = useState("");
  const [notes, setNotes] = useState("");
  const [expectedCash, setExpectedCash] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [transactionCount, setTransactionCount] = useState(0);

  useEffect(() => {
    if (open && user) {
      loadTodaysSummary();
    }
  }, [open, user]);

  const loadTodaysSummary = async () => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    
    // Get today's sales for this cashier
    const { data: sales, error } = await supabase
      .from('sales')
      .select('*')
      .eq('cashier_id', user.id)
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`);

    if (error) {
      toast.error("Failed to load sales summary");
      return;
    }

    if (sales) {
      const cashSales = sales.filter(s => s.payment_method === 'cash');
      const expectedCashTotal = cashSales.reduce((sum, s) => sum + Number(s.total), 0);
      
      setExpectedCash(expectedCashTotal);
      setTotalSales(sales.reduce((sum, s) => sum + Number(s.total), 0));
      setTransactionCount(sales.length);
    }
  };

  const handleSubmit = async () => {
    if (!user || !actualCash) {
      toast.error("Please enter the actual cash amount");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('eod_sessions')
        .insert({
          cashier_id: user.id,
          expected_cash: expectedCash,
          actual_cash: Number(actualCash),
          total_sales: totalSales,
          total_transactions: transactionCount,
          cashier_notes: notes || null,
          submitted_at: new Date().toISOString(),
          status: 'pending'
        });

      if (error) throw error;

      toast.success("End of Day submitted for approval");
      onSubmitted();
      onOpenChange(false);
      
      // Reset form
      setActualCash("");
      setNotes("");
    } catch (error: any) {
      toast.error("Failed to submit EOD: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const difference = actualCash ? Number(actualCash) - expectedCash : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>End of Day Report</DialogTitle>
          <DialogDescription>
            Submit your end of day cash reconciliation for admin approval
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Total Sales Today</Label>
              <div className="text-2xl font-bold">R{totalSales.toFixed(2)}</div>
            </div>
            <div>
              <Label>Total Transactions</Label>
              <div className="text-2xl font-bold">{transactionCount}</div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Expected Cash (from cash sales)</Label>
            <div className="text-lg font-semibold text-muted-foreground">
              R{expectedCash.toFixed(2)}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="actual-cash">Actual Cash Counted *</Label>
            <Input
              id="actual-cash"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={actualCash}
              onChange={(e) => setActualCash(e.target.value)}
            />
          </div>

          {actualCash && (
            <div className={`p-3 rounded-md ${difference === 0 ? 'bg-green-50 dark:bg-green-950' : 'bg-yellow-50 dark:bg-yellow-950'}`}>
              <Label>Difference</Label>
              <div className={`text-xl font-bold ${difference === 0 ? 'text-green-600 dark:text-green-400' : difference > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                {difference >= 0 ? '+' : ''}R{difference.toFixed(2)}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any notes or explanations for discrepancies..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !actualCash}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit for Approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
