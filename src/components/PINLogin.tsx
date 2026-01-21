import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Delete, LogIn } from 'lucide-react';
import logo from '@/assets/casbah-logo.svg';

interface PINLoginProps {
  onSuccess: (userId: string, role: string) => void;
  onSwitchToEmail: () => void;
}

const PINLogin = ({ onSuccess, onSwitchToEmail }: PINLoginProps) => {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleNumberPress = useCallback((num: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + num);
    }
  }, [pin.length]);

  const handleDelete = useCallback(() => {
    setPin(prev => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setPin('');
  }, []);

  const handleSubmit = async () => {
    if (pin.length < 4) {
      toast.error('PIN must be at least 4 digits');
      return;
    }

    setLoading(true);
    try {
      // Call secure server-side PIN verification
      const { data, error } = await supabase.functions.invoke('verify-pin', {
        body: { pin }
      });

      if (error) {
        console.error('PIN verification error:', error);
        toast.error('Verification failed. Please try again.');
        setPin('');
        return;
      }

      if (!data.success) {
        toast.error(data.error || 'Invalid PIN');
        setPin('');
        return;
      }

      toast.success(`Welcome, ${data.user.full_name}!`);
      onSuccess(data.user.id, data.user.role || 'cashier');
    } catch (error: any) {
      console.error('PIN login error:', error);
      toast.error('Login failed. Please try again.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <img src={logo} alt="Mr Tech Solutions Logo" className="h-16 w-auto" />
          </div>
          <CardTitle className="text-xl font-bold">Staff Login</CardTitle>
          <p className="text-sm text-muted-foreground">Enter your PIN to clock in</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* PIN Display */}
          <div className="flex justify-center gap-2 py-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 transition-all ${
                  i < pin.length 
                    ? 'bg-primary border-primary' 
                    : 'border-muted-foreground/30'
                }`}
              />
            ))}
          </div>

          {/* Number Pad */}
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <Button
                key={num}
                variant="outline"
                size="lg"
                className="h-14 text-xl font-semibold"
                onClick={() => handleNumberPress(num)}
                disabled={loading}
              >
                {num}
              </Button>
            ))}
            <Button
              variant="outline"
              size="lg"
              className="h-14 text-sm"
              onClick={handleClear}
              disabled={loading}
            >
              Clear
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-14 text-xl font-semibold"
              onClick={() => handleNumberPress('0')}
              disabled={loading}
            >
              0
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-14"
              onClick={handleDelete}
              disabled={loading}
            >
              <Delete className="h-5 w-5" />
            </Button>
          </div>

          {/* Submit Button */}
          <Button
            className="w-full h-12"
            onClick={handleSubmit}
            disabled={loading || pin.length < 4}
          >
            {loading ? (
              'Verifying...'
            ) : (
              <>
                <LogIn className="mr-2 h-4 w-4" />
                Clock In
              </>
            )}
          </Button>

          {/* Switch to Email Login */}
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={onSwitchToEmail}
              className="text-sm text-muted-foreground hover:text-primary underline"
            >
              Admin? Login with email
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Server-side hash function for admin PIN setting
// This is only used when setting PINs, not for verification
export async function hashPIN(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + 'mrtech-salt-2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default PINLogin;
