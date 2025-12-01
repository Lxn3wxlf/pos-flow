import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppHeader from "@/components/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Play, Square, Coffee, Fingerprint } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { biometricAuth } from "@/lib/biometricAuth";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TimeEntry {
  id: string;
  clock_in: string;
  clock_out: string | null;
  break_start: string | null;
  break_end: string | null;
  total_hours: number | null;
  total_cost: number | null;
}

export default function TimeTracking() {
  const { user } = useAuth();
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([]);
  const [onBreak, setOnBreak] = useState(false);
  const [loading, setLoading] = useState(true);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);

  useEffect(() => {
    fetchActiveEntry();
    fetchRecentEntries();
    checkBiometricAvailability();
  }, [user]);

  const checkBiometricAvailability = async () => {
    const available = await biometricAuth.isAvailable();
    setBiometricAvailable(available);
  };

  const fetchActiveEntry = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("time_tracking")
        .select("*")
        .eq("employee_id", user.id)
        .is("clock_out", null)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      setActiveEntry(data);
      if (data?.break_start && !data?.break_end) {
        setOnBreak(true);
      }
    } catch (error) {
      console.error("Error fetching active entry:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentEntries = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("time_tracking")
        .select("*")
        .eq("employee_id", user.id)
        .not("clock_out", "is", null)
        .order("clock_in", { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecentEntries(data || []);
    } catch (error) {
      console.error("Error fetching recent entries:", error);
    }
  };

  const handleClockIn = async () => {
    if (!user) return;

    // Verify biometric if available
    if (biometricAvailable) {
      setAuthenticating(true);
      const result = await biometricAuth.authenticate('Verify your identity to clock in');
      setAuthenticating(false);

      if (!result.success) {
        toast.error(result.error || 'Biometric verification failed');
        return;
      }
    }

    try {
      const { data, error } = await supabase
        .from("time_tracking")
        .insert([{
          employee_id: user.id,
          clock_in: new Date().toISOString(),
          hourly_rate: 50 // Default rate, should be configurable
        }])
        .select()
        .single();

      if (error) throw error;
      setActiveEntry(data);
      toast.success("Clocked in successfully");
    } catch (error) {
      console.error("Error clocking in:", error);
      toast.error("Failed to clock in");
    }
  };

  const handleClockOut = async () => {
    if (!activeEntry) return;

    // Verify biometric if available
    if (biometricAvailable) {
      setAuthenticating(true);
      const result = await biometricAuth.authenticate('Verify your identity to clock out');
      setAuthenticating(false);

      if (!result.success) {
        toast.error(result.error || 'Biometric verification failed');
        return;
      }
    }

    try {
      const { error } = await supabase
        .from("time_tracking")
        .update({ clock_out: new Date().toISOString() })
        .eq("id", activeEntry.id);

      if (error) throw error;
      setActiveEntry(null);
      fetchRecentEntries();
      toast.success("Clocked out successfully");
    } catch (error) {
      console.error("Error clocking out:", error);
      toast.error("Failed to clock out");
    }
  };

  const handleStartBreak = async () => {
    if (!activeEntry) return;

    try {
      const { error } = await supabase
        .from("time_tracking")
        .update({ break_start: new Date().toISOString() })
        .eq("id", activeEntry.id);

      if (error) throw error;
      setOnBreak(true);
      fetchActiveEntry();
      toast.success("Break started");
    } catch (error) {
      console.error("Error starting break:", error);
      toast.error("Failed to start break");
    }
  };

  const handleEndBreak = async () => {
    if (!activeEntry) return;

    try {
      const { error } = await supabase
        .from("time_tracking")
        .update({ break_end: new Date().toISOString() })
        .eq("id", activeEntry.id);

      if (error) throw error;
      setOnBreak(false);
      fetchActiveEntry();
      toast.success("Break ended");
    } catch (error) {
      console.error("Error ending break:", error);
      toast.error("Failed to end break");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader>
          <h1 className="text-2xl font-bold">Time Tracking</h1>
        </AppHeader>
        <div className="container mx-auto p-6">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader>
        <h1 className="text-2xl font-bold">Time Tracking</h1>
      </AppHeader>
      <div className="container mx-auto p-6">
        {biometricAvailable && (
          <Alert className="mb-6 border-primary/20 bg-primary/5">
            <Fingerprint className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm">
              Biometric authentication is enabled for secure clock in/out
            </AlertDescription>
          </Alert>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Current Shift
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeEntry ? (
              <>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">Clocked in at</p>
                  <p className="text-2xl font-bold">
                    {format(new Date(activeEntry.clock_in), "HH:mm")}
                  </p>
                </div>
                <div className="flex gap-2 justify-center">
                  {!onBreak ? (
                    <>
                      <Button onClick={handleStartBreak} variant="outline">
                        <Coffee className="mr-2 h-4 w-4" />
                        Start Break
                      </Button>
                      <Button onClick={handleClockOut} variant="destructive">
                        <Square className="mr-2 h-4 w-4" />
                        Clock Out
                      </Button>
                    </>
                  ) : (
                    <Button onClick={handleEndBreak}>
                      <Play className="mr-2 h-4 w-4" />
                      End Break
                    </Button>
                  )}
                </div>
                {onBreak && (
                  <p className="text-center text-yellow-600 font-semibold">On Break</p>
                )}
              </>
            ) : (
              <div className="text-center">
                <p className="text-muted-foreground mb-4">Not clocked in</p>
                <Button 
                  onClick={handleClockIn} 
                  size="lg" 
                  disabled={authenticating}
                  className="gap-2"
                >
                  {biometricAvailable ? (
                    <Fingerprint className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {authenticating ? 'Verifying...' : 'Clock In'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Shifts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentEntries.map((entry) => (
                <div key={entry.id} className="flex justify-between items-center p-3 border rounded">
                  <div>
                    <p className="font-semibold">
                      {format(new Date(entry.clock_in), "MMM dd, yyyy")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(entry.clock_in), "HH:mm")} - {entry.clock_out && format(new Date(entry.clock_out), "HH:mm")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{entry.total_hours?.toFixed(2)} hrs</p>
                    <p className="text-sm text-muted-foreground">R{entry.total_cost?.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}