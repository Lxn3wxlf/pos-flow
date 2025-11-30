import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AppHeader from "@/components/AppHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Eye } from "lucide-react";
import { format } from "date-fns";

interface EODSession {
  id: string;
  cashier_id: string;
  shift_date: string;
  status: string;
  expected_cash: number;
  actual_cash: number;
  cash_difference: number;
  total_sales: number;
  total_transactions: number;
  cashier_notes: string | null;
  admin_notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  cashier?: {
    full_name: string;
  };
}

export default function AdminEOD() {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<EODSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<EODSession | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [salesDetails, setSalesDetails] = useState<any[]>([]);

  useEffect(() => {
    loadEODSessions();
  }, []);

  const loadEODSessions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('eod_sessions')
      .select(`
        *,
        cashier:profiles!eod_sessions_cashier_id_fkey(full_name)
      `)
      .order('submitted_at', { ascending: false });

    if (error) {
      toast.error("Failed to load EOD sessions");
      setLoading(false);
      return;
    }

    setSessions(data || []);
    setLoading(false);
  };

  const handleApprove = async (session: EODSession) => {
    const { error } = await supabase
      .from('eod_sessions')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: profile?.id,
        admin_notes: adminNotes || null
      })
      .eq('id', session.id);

    if (error) {
      toast.error("Failed to approve EOD");
      return;
    }

    toast.success("EOD approved - POS unlocked for cashier");
    setSelectedSession(null);
    setAdminNotes("");
    loadEODSessions();
  };

  const handleReject = async (session: EODSession) => {
    if (!adminNotes.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    const { error } = await supabase
      .from('eod_sessions')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: profile?.id,
        admin_notes: adminNotes
      })
      .eq('id', session.id);

    if (error) {
      toast.error("Failed to reject EOD");
      return;
    }

    toast.success("EOD rejected - cashier will need to resubmit");
    setSelectedSession(null);
    setAdminNotes("");
    loadEODSessions();
  };

  const viewTransactionDetails = async (session: EODSession) => {
    const shiftDate = session.shift_date;
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('cashier_id', session.cashier_id)
      .gte('created_at', `${shiftDate}T00:00:00`)
      .lte('created_at', `${shiftDate}T23:59:59`)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error("Failed to load transaction details");
      return;
    }

    setSalesDetails(data || []);
    setViewDetailsOpen(true);
  };

  if (!profile?.roles?.includes('admin')) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader>
        <div className="text-left">
          <h1 className="text-xl font-bold">End of Day Management</h1>
        </div>
      </AppHeader>
      
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>EOD Submissions</CardTitle>
            <CardDescription>Review and approve cashier end of day reports</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No EOD sessions found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Cashier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Expected Cash</TableHead>
                    <TableHead className="text-right">Actual Cash</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                    <TableHead className="text-right">Total Sales</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>{format(new Date(session.shift_date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>{session.cashier?.full_name}</TableCell>
                      <TableCell>
                        <Badge variant={
                          session.status === 'approved' ? 'default' : 
                          session.status === 'rejected' ? 'destructive' : 
                          'secondary'
                        }>
                          {session.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">R{session.expected_cash.toFixed(2)}</TableCell>
                      <TableCell className="text-right">R{session.actual_cash.toFixed(2)}</TableCell>
                      <TableCell className={`text-right font-semibold ${
                        session.cash_difference === 0 ? 'text-green-600 dark:text-green-400' :
                        session.cash_difference > 0 ? 'text-blue-600 dark:text-blue-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {session.cash_difference >= 0 ? '+' : ''}R{session.cash_difference.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">R{session.total_sales.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => viewTransactionDetails(session)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {session.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedSession(session)}
                              >
                                Review
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Review Dialog */}
      <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Review EOD Submission</DialogTitle>
            <DialogDescription>
              {selectedSession?.cashier?.full_name} - {selectedSession && format(new Date(selectedSession.shift_date), 'MMM dd, yyyy')}
            </DialogDescription>
          </DialogHeader>

          {selectedSession && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Expected Cash</Label>
                  <div className="text-lg font-semibold">R{selectedSession.expected_cash.toFixed(2)}</div>
                </div>
                <div>
                  <Label>Actual Cash</Label>
                  <div className="text-lg font-semibold">R{selectedSession.actual_cash.toFixed(2)}</div>
                </div>
                <div>
                  <Label>Difference</Label>
                  <div className={`text-lg font-bold ${
                    selectedSession.cash_difference === 0 ? 'text-green-600 dark:text-green-400' :
                    selectedSession.cash_difference > 0 ? 'text-blue-600 dark:text-blue-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    {selectedSession.cash_difference >= 0 ? '+' : ''}R{selectedSession.cash_difference.toFixed(2)}
                  </div>
                </div>
                <div>
                  <Label>Total Sales</Label>
                  <div className="text-lg font-semibold">R{selectedSession.total_sales.toFixed(2)}</div>
                </div>
              </div>

              {selectedSession.cashier_notes && (
                <div>
                  <Label>Cashier Notes</Label>
                  <div className="p-3 bg-muted rounded-md text-sm">
                    {selectedSession.cashier_notes}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="admin-notes">Admin Notes</Label>
                <Textarea
                  id="admin-notes"
                  placeholder="Add notes about this submission..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => selectedSession && handleReject(selectedSession)}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
            <Button
              onClick={() => selectedSession && handleApprove(selectedSession)}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction Details Dialog */}
      <Dialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>Detailed list of all transactions</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {salesDetails.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No transactions found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesDetails.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="text-sm">
                        {format(new Date(sale.created_at), 'HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{sale.payment_method}</Badge>
                      </TableCell>
                      <TableCell className="text-right">R{Number(sale.subtotal).toFixed(2)}</TableCell>
                      <TableCell className="text-right">R{Number(sale.tax_amount).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">R{Number(sale.total).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
