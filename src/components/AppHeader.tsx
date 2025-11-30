import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Phone, MapPin } from 'lucide-react';

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
        {/* Page-specific content (includes logo, title, and actions) */}
        {children}

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

        {/* Contact info - Right side */}
        <div className="flex justify-end">
          <div className="flex flex-col items-end gap-0.5 text-sm text-muted-foreground">
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
      </div>
    </div>
  );
};

export default AppHeader;
