import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ShoppingCart, Store, Lock } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-6 mb-16">
          <div className="flex justify-center">
            <div className="p-4 bg-primary rounded-2xl shadow-lg">
              <ShoppingCart className="h-16 w-16 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Modern POS System
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            A complete point-of-sale solution with offline support, inventory management, and real-time sync
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-12">
          <Card className="hover:shadow-xl transition-all">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Store className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>For Cashiers</CardTitle>
              </div>
              <CardDescription>
                Fast and intuitive register interface for processing sales
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                <li>✓ Offline-first operation</li>
                <li>✓ Quick product search</li>
                <li>✓ Easy cart management</li>
                <li>✓ Receipt printing</li>
              </ul>
              <Button asChild className="w-full">
                <Link to="/auth">Access POS Register</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-xl transition-all">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <Lock className="h-6 w-6 text-accent" />
                </div>
                <CardTitle>For Administrators</CardTitle>
              </div>
              <CardDescription>
                Comprehensive dashboard for managing your business
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                <li>✓ Product & inventory management</li>
                <li>✓ Sales history & analytics</li>
                <li>✓ Reports & CSV exports</li>
                <li>✓ Multi-user support</li>
              </ul>
              <Button asChild variant="outline" className="w-full">
                <Link to="/auth">Admin Login</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Card className="max-w-2xl mx-auto bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
            <CardHeader>
              <CardTitle>Key Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div>
                  <h4 className="font-semibold mb-1">🔄 Offline First</h4>
                  <p className="text-sm text-muted-foreground">
                    Works without internet, syncs when back online
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">📊 Real-time Sync</h4>
                  <p className="text-sm text-muted-foreground">
                    Automatic sync across all terminals
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">🛡️ Role-based Access</h4>
                  <p className="text-sm text-muted-foreground">
                    Separate interfaces for cashiers and admins
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">💾 Cloud Database</h4>
                  <p className="text-sm text-muted-foreground">
                    Secure PostgreSQL with automated backups
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
