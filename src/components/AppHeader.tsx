import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Phone, MapPin } from 'lucide-react';
import logo from '@/assets/casbah-logo.svg';

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
        {/* Logo and contact info */}
        <div className="flex flex-col items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin')}
            className="h-16 px-4"
            aria-label="Go to home"
          >
            <img src={logo} alt="Casbah Logo" className="h-12 w-auto" />
          </Button>
          <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              <span>065 683 5702</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span>194 Marine Drive</span>
            </div>
          </div>
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
