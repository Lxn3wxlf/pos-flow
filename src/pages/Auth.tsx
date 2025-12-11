import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import logo from '@/assets/casbah-logo.svg';
import PINLogin from '@/components/PINLogin';
import { signInSchema, signUpSchema, validateForm, getFirstError } from '@/lib/validations';

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loginMode, setLoginMode] = useState<'pin' | 'email'>('pin');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  // Check if user is already logged in
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        redirectBasedOnRole(session.user.id);
      }
    };
    checkSession();
  }, []);

  const redirectBasedOnRole = async (userId: string) => {
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    const userRoles = roles?.map(r => r.role) || [];
    
    if (userRoles.includes('admin')) {
      navigate('/admin');
    } else if (userRoles.includes('waiter')) {
      navigate('/waiter');
    } else if (userRoles.includes('kitchen')) {
      navigate('/kitchen');
    } else if (userRoles.includes('cashier')) {
      navigate('/pos');
    } else {
      navigate('/');
    }
  };

  const handlePINSuccess = (userId: string, role: string) => {
    // For PIN login, redirect based on role
    if (role === 'admin') {
      navigate('/admin');
    } else if (role === 'waiter') {
      navigate('/waiter');
    } else if (role === 'kitchen') {
      navigate('/kitchen');
    } else {
      navigate('/pos');
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    // Validate input
    const validation = validateForm(signInSchema, { email, password });
    if (validation.success === false) {
      setErrors(validation.errors);
      toast.error(getFirstError(validation.errors));
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: validation.data.email,
        password: validation.data.password
      });

      if (error) throw error;

      if (data.user) {
        toast.success('Signed in successfully');
        await redirectBasedOnRole(data.user.id);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    // Validate input
    const validation = validateForm(signUpSchema, { fullName, email, password });
    if (validation.success === false) {
      setErrors(validation.errors);
      toast.error(getFirstError(validation.errors));
      return;
    }

    setLoading(true);

    try {
      // Note: Role is NOT sent to signup - server always assigns 'cashier'
      const { data, error } = await supabase.auth.signUp({
        email: validation.data.email,
        password: validation.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: validation.data.fullName
            // Role removed - server hardcodes 'cashier' for security
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        toast.success('Account created! You have been assigned as a cashier. Contact admin for role changes.');
        navigate('/pos');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  // Show PIN login for staff
  if (loginMode === 'pin') {
    return (
      <PINLogin
        onSuccess={handlePINSuccess}
        onSwitchToEmail={() => setLoginMode('email')}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <img src={logo} alt="Casbah Logo" className="h-16 w-auto" />
          </div>
          <CardTitle className="text-2xl font-bold">Casbah POS</CardTitle>
          <CardDescription>
            Sign in to your account or create a new one
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setErrors({}); }}
                    className={errors.email ? 'border-destructive' : ''}
                    required
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors({}); }}
                    className={errors.password ? 'border-destructive' : ''}
                    required
                  />
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => { setFullName(e.target.value); setErrors({}); }}
                    className={errors.fullName ? 'border-destructive' : ''}
                    required
                  />
                  {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setErrors({}); }}
                    className={errors.email ? 'border-destructive' : ''}
                    required
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors({}); }}
                    className={errors.password ? 'border-destructive' : ''}
                    required
                    minLength={6}
                  />
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>
                <p className="text-xs text-muted-foreground">
                  New accounts are assigned as Cashier. Contact admin for role changes.
                </p>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Creating account...' : 'Create Account'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          
          {/* Switch back to PIN login */}
          <div className="text-center pt-4 border-t">
            <button
              type="button"
              onClick={() => setLoginMode('pin')}
              className="text-sm text-muted-foreground hover:text-primary underline"
            >
              Staff? Use PIN login
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
