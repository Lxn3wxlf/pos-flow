import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ShoppingCart } from 'lucide-react';

interface AppHeaderProps {
  children: React.ReactNode;
}

const AppHeader = ({ children }: AppHeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isHomePage = location.pathname === '/admin';

  return (
    <div className="border-b bg-card">
      <div className="p-4 space-y-3">
        {/* Logo - clickable home button */}
        <div className="flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin')}
            className="h-12 w-12"
            aria-label="Go to home"
          >
            <ShoppingCart className="h-8 w-8 text-primary" />
          </Button>
        </div>

        {/* Back button - shown on all pages except home */}
        {!isHomePage && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(-1)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
        )}

        {/* Page-specific content */}
        {children}
      </div>
    </div>
  );
};

export default AppHeader;
