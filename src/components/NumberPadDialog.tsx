import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Delete } from 'lucide-react';

interface NumberPadDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title?: string;
  initialValue?: string;
}

const NumberPadDialog = ({ open, onClose, onConfirm, title = 'Enter Amount', initialValue = '' }: NumberPadDialogProps) => {
  const [value, setValue] = useState(initialValue);

  // Sync value when dialog opens
  useEffect(() => {
    if (open) {
      setValue(initialValue);
    }
  }, [open, initialValue]);
  const handlePress = (digit: string) => {
    if (digit === '.' && value.includes('.')) return;
    if (digit === '.' && value === '') {
      setValue('0.');
      return;
    }
    setValue(prev => prev + digit);
  };

  const handleDelete = () => {
    setValue(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setValue('');
  };

  const handleConfirm = () => {
    onConfirm(value);
    setValue('');
    onClose();
  };

  const handleQuickAmount = (amount: number) => {
    setValue(amount.toString());
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) { setValue(''); onClose(); } }}>
      <DialogContent className="sm:max-w-[320px] p-4">
        <DialogHeader>
          <DialogTitle className="text-center">{title}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3">
          {/* Display */}
          <div className="text-right text-3xl font-bold p-3 bg-muted rounded-lg min-h-[56px] flex items-center justify-end">
            <span className="text-muted-foreground mr-1">R</span>
            {value || '0.00'}
          </div>

          {/* Quick amounts */}
          <div className="grid grid-cols-4 gap-1">
            {[50, 100, 200, 500].map(amount => (
              <Button
                key={amount}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => handleQuickAmount(amount)}
              >
                R{amount}
              </Button>
            ))}
          </div>

          {/* Number pad */}
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map(digit => (
              <Button
                key={digit}
                variant="outline"
                size="lg"
                className="text-xl font-semibold h-14"
                onClick={() => handlePress(digit)}
              >
                {digit}
              </Button>
            ))}
            <Button
              variant="outline"
              size="lg"
              className="text-xl h-14"
              onClick={handleDelete}
            >
              <Delete className="h-5 w-5" />
            </Button>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={handleClear}>Clear</Button>
            <Button onClick={handleConfirm} disabled={!value}>Confirm</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NumberPadDialog;
