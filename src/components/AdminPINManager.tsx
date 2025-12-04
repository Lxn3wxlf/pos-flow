import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Key, RefreshCw } from 'lucide-react';
import { hashPIN } from './PINLogin';

interface AdminPINManagerProps {
  userId: string;
  userName: string;
  hasPin: boolean;
  onPinUpdated: () => void;
}

const AdminPINManager = ({ userId, userName, hasPin, onPinUpdated }: AdminPINManagerProps) => {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);

  const generateRandomPIN = () => {
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
    setPin(randomPin);
    setConfirmPin(randomPin);
    toast.info(`Generated PIN: ${randomPin}`, { duration: 5000 });
  };

  const handleSubmit = async () => {
    if (pin.length < 4 || pin.length > 6) {
      toast.error('PIN must be 4-6 digits');
      return;
    }

    if (!/^\d+$/.test(pin)) {
      toast.error('PIN must contain only numbers');
      return;
    }

    if (pin !== confirmPin) {
      toast.error('PINs do not match');
      return;
    }

    setLoading(true);
    try {
      const hashedPin = await hashPIN(pin);
      
      const { error } = await supabase
        .from('profiles')
        .update({ pin_hash: hashedPin })
        .eq('id', userId);

      if (error) throw error;

      toast.success(`PIN ${hasPin ? 'updated' : 'set'} for ${userName}`);
      setOpen(false);
      setPin('');
      setConfirmPin('');
      onPinUpdated();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update PIN');
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePIN = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ pin_hash: null })
        .eq('id', userId);

      if (error) throw error;

      toast.success(`PIN removed for ${userName}`);
      setOpen(false);
      onPinUpdated();
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Key className="h-4 w-4 mr-1" />
          {hasPin ? 'Change PIN' : 'Set PIN'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {hasPin ? 'Change' : 'Set'} PIN for {userName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="pin">New PIN (4-6 digits)</Label>
            <div className="flex gap-2">
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="Enter PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              />
              <Button
                type="button"
                variant="outline"
                onClick={generateRandomPIN}
                title="Generate Random PIN"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPin">Confirm PIN</Label>
            <Input
              id="confirmPin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="Confirm PIN"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={loading || pin.length < 4}
            >
              {loading ? 'Saving...' : 'Save PIN'}
            </Button>
            {hasPin && (
              <Button
                variant="destructive"
                onClick={handleRemovePIN}
                disabled={loading}
              >
                Remove
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPINManager;
