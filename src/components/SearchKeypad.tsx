import { Button } from '@/components/ui/button';
import { Delete, X } from 'lucide-react';

interface SearchKeypadProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const SearchKeypad = ({ value, onChange, disabled }: SearchKeypadProps) => {
  const row1 = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];
  const row2 = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'];
  const row3 = ['Z', 'X', 'C', 'V', 'B', 'N', 'M'];
  const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

  const handleKey = (key: string) => {
    onChange(value + key.toLowerCase());
  };

  const handleDelete = () => {
    onChange(value.slice(0, -1));
  };

  const handleClear = () => {
    onChange('');
  };

  const handleSpace = () => {
    onChange(value + ' ');
  };

  return (
    <div className="space-y-1 pt-2">
      {/* Numbers row */}
      <div className="flex gap-0.5 justify-center">
        {numbers.map(key => (
          <Button
            key={key}
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 text-xs font-medium"
            onClick={() => handleKey(key)}
            disabled={disabled}
          >
            {key}
          </Button>
        ))}
      </div>
      
      {/* Letter rows */}
      <div className="flex gap-0.5 justify-center">
        {row1.map(key => (
          <Button
            key={key}
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 text-xs font-medium"
            onClick={() => handleKey(key)}
            disabled={disabled}
          >
            {key}
          </Button>
        ))}
      </div>
      
      <div className="flex gap-0.5 justify-center">
        {row2.map(key => (
          <Button
            key={key}
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 text-xs font-medium"
            onClick={() => handleKey(key)}
            disabled={disabled}
          >
            {key}
          </Button>
        ))}
      </div>
      
      <div className="flex gap-0.5 justify-center">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-12 p-0 text-xs"
          onClick={handleClear}
          disabled={disabled}
        >
          <X className="h-3 w-3" />
        </Button>
        {row3.map(key => (
          <Button
            key={key}
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 text-xs font-medium"
            onClick={() => handleKey(key)}
            disabled={disabled}
          >
            {key}
          </Button>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-12 p-0 text-xs"
          onClick={handleDelete}
          disabled={disabled}
        >
          <Delete className="h-3 w-3" />
        </Button>
      </div>
      
      {/* Space bar */}
      <div className="flex gap-0.5 justify-center">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-32 p-0 text-xs"
          onClick={handleSpace}
          disabled={disabled}
        >
          Space
        </Button>
      </div>
    </div>
  );
};

export default SearchKeypad;
