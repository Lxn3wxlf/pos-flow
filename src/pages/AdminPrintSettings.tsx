import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Pencil, Trash2, Printer, Route, Image, Upload, Usb, RefreshCw, CheckCircle, XCircle, Play } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import logo from '@/assets/casbah-logo.svg';
import { 
  initQZTray, 
  isQZConnected, 
  listPrinters, 
  fetchQZPrinterConfig, 
  saveQZPrinterConfig, 
  testPrint,
  QZPrinterConfig 
} from '@/lib/qzTray';

interface PrinterSetting {
  id: string;
  name: string;
  ip_address: string;
  printer_type: 'kitchen' | 'receipt' | 'bar';
  is_active: boolean;
  created_at: string;
}

interface RoutingRule {
  id: string;
  category_name: string;
  printer_id: string;
  printer_name?: string;
}

interface ReceiptBranding {
  id: string;
  logo_url: string | null;
  business_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  phone: string | null;
  footer_text: string | null;
}

const AdminPrintSettings = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  
  // Printer settings state
  const [printers, setPrinters] = useState<PrinterSetting[]>([]);
  const [printerDialogOpen, setPrinterDialogOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<PrinterSetting | null>(null);
  const [printerName, setPrinterName] = useState('');
  const [printerIp, setPrinterIp] = useState('');
  const [printerType, setPrinterType] = useState<'kitchen' | 'receipt' | 'bar'>('receipt');
  
  // Routing rules state
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>([]);
  const [routingDialogOpen, setRoutingDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPrinterId, setSelectedPrinterId] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  
  // Branding state
  const [branding, setBranding] = useState<ReceiptBranding | null>(null);
  const [brandingForm, setBrandingForm] = useState({
    business_name: '',
    address_line1: '',
    address_line2: '',
    phone: '',
    footer_text: '',
    logo_url: ''
  });
  const [uploading, setUploading] = useState(false);
  
  // QZ Tray state
  const [qzConnected, setQzConnected] = useState(false);
  const [qzPrinters, setQzPrinters] = useState<string[]>([]);
  const [qzConfig, setQzConfig] = useState<QZPrinterConfig>({ cashier: null, kitchen: null });
  const [qzLoading, setQzLoading] = useState(false);
  const [qzSelectedCashier, setQzSelectedCashier] = useState('');
  const [qzSelectedKitchen, setQzSelectedKitchen] = useState('');
  
  const [loading, setLoading] = useState(true);

  if (!user) return <Navigate to="/auth" />;
  if (!profile?.roles?.includes('admin')) return <Navigate to="/pos" />;

  useEffect(() => {
    fetchData();
    initQZConnection();
  }, []);

  const initQZConnection = async () => {
    const connected = await initQZTray();
    setQzConnected(connected);
    if (connected) {
      await refreshQZPrinters();
      await loadQZConfig();
    }
  };

  const refreshQZPrinters = async () => {
    setQzLoading(true);
    try {
      const printerList = await listPrinters();
      setQzPrinters(printerList);
    } catch (err) {
      console.error('Failed to list QZ printers:', err);
    } finally {
      setQzLoading(false);
    }
  };

  const loadQZConfig = async () => {
    const config = await fetchQZPrinterConfig();
    setQzConfig(config);
    setQzSelectedCashier(config.cashier || '');
    setQzSelectedKitchen(config.kitchen || '');
  };

  const handleSaveQZPrinter = async (label: 'cashier' | 'kitchen', printerName: string) => {
    if (!printerName) {
      toast.error('Please select a printer');
      return;
    }
    const success = await saveQZPrinterConfig(label, printerName);
    if (success) {
      toast.success(`${label === 'cashier' ? 'Cashier' : 'Kitchen'} printer saved`);
      await loadQZConfig();
    } else {
      toast.error('Failed to save printer configuration');
    }
  };

  const handleTestQZPrint = async (printerName: string) => {
    if (!printerName) {
      toast.error('No printer selected');
      return;
    }
    toast.info('Sending test print...');
    const success = await testPrint(printerName);
    if (success) {
      toast.success('Test print sent successfully');
    } else {
      toast.error('Test print failed');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch printers
      const { data: printersData, error: printersError } = await supabase
        .from('printer_settings')
        .select('*')
        .order('name');

      if (printersError) throw printersError;
      setPrinters((printersData || []).map(p => ({
        ...p,
        printer_type: p.printer_type as 'kitchen' | 'receipt' | 'bar'
      })));

      // Fetch routing rules
      const { data: rulesData, error: rulesError } = await supabase
        .from('print_routing_rules')
        .select('*, printer_settings(name)');

      if (rulesError) throw rulesError;
      setRoutingRules(rulesData?.map(r => ({
        ...r,
        printer_name: (r.printer_settings as any)?.name
      })) || []);

      // Fetch categories from database
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('name')
        .order('name');

      if (!categoriesError && categoriesData) {
        setCategories(categoriesData.map(c => c.name));
      }

      // Fetch branding
      const { data: brandingData, error: brandingError } = await supabase
        .from('receipt_branding')
        .select('*')
        .limit(1)
        .single();

      if (brandingData) {
        setBranding(brandingData);
        setBrandingForm({
          business_name: brandingData.business_name || '',
          address_line1: brandingData.address_line1 || '',
          address_line2: brandingData.address_line2 || '',
          phone: brandingData.phone || '',
          footer_text: brandingData.footer_text || '',
          logo_url: brandingData.logo_url || ''
        });
      }
    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Printer CRUD
  const openPrinterDialog = (printer?: PrinterSetting) => {
    if (printer) {
      setEditingPrinter(printer);
      setPrinterName(printer.name);
      setPrinterIp(printer.ip_address);
      setPrinterType(printer.printer_type);
    } else {
      setEditingPrinter(null);
      setPrinterName('');
      setPrinterIp('');
      setPrinterType('receipt');
    }
    setPrinterDialogOpen(true);
  };

  const handleSavePrinter = async () => {
    if (!printerName.trim() || !printerIp.trim()) {
      toast.error('Name and IP address are required');
      return;
    }

    try {
      if (editingPrinter) {
        const { error } = await supabase
          .from('printer_settings')
          .update({
            name: printerName,
            ip_address: printerIp,
            printer_type: printerType
          })
          .eq('id', editingPrinter.id);

        if (error) throw error;
        toast.success('Printer updated');
      } else {
        const { error } = await supabase
          .from('printer_settings')
          .insert({
            name: printerName,
            ip_address: printerIp,
            printer_type: printerType
          });

        if (error) throw error;
        toast.success('Printer added');
      }

      setPrinterDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save printer');
    }
  };

  const handleDeletePrinter = async (printer: PrinterSetting) => {
    if (!confirm(`Delete printer "${printer.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('printer_settings')
        .delete()
        .eq('id', printer.id);

      if (error) throw error;
      toast.success('Printer deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete printer');
    }
  };

  const togglePrinterActive = async (printer: PrinterSetting) => {
    try {
      const { error } = await supabase
        .from('printer_settings')
        .update({ is_active: !printer.is_active })
        .eq('id', printer.id);

      if (error) throw error;
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update printer');
    }
  };

  // Routing Rules
  const openRoutingDialog = () => {
    setSelectedCategory('');
    setSelectedPrinterId('');
    setRoutingDialogOpen(true);
  };

  const handleSaveRouting = async () => {
    if (!selectedCategory || !selectedPrinterId) {
      toast.error('Select both category and printer');
      return;
    }

    try {
      // Check if rule already exists
      const existing = routingRules.find(r => r.category_name === selectedCategory);
      
      if (existing) {
        const { error } = await supabase
          .from('print_routing_rules')
          .update({ printer_id: selectedPrinterId })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('print_routing_rules')
          .insert({
            category_name: selectedCategory,
            printer_id: selectedPrinterId
          });

        if (error) throw error;
      }

      toast.success('Routing rule saved');
      setRoutingDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save routing rule');
    }
  };

  const handleDeleteRouting = async (rule: RoutingRule) => {
    try {
      const { error } = await supabase
        .from('print_routing_rules')
        .delete()
        .eq('id', rule.id);

      if (error) throw error;
      toast.success('Routing rule deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete routing rule');
    }
  };

  // Branding
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `receipt-logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      setBrandingForm(prev => ({ ...prev, logo_url: urlData.publicUrl }));
      toast.success('Logo uploaded');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveBranding = async () => {
    try {
      if (branding) {
        const { error } = await supabase
          .from('receipt_branding')
          .update(brandingForm)
          .eq('id', branding.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('receipt_branding')
          .insert(brandingForm);

        if (error) throw error;
      }

      toast.success('Branding saved');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save branding');
    }
  };

  const getPrinterTypeBadge = (type: string) => {
    switch (type) {
      case 'kitchen': return 'destructive';
      case 'receipt': return 'default';
      case 'bar': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <img 
            src={logo} 
            alt="Casbah Logo" 
            className="h-8 w-auto cursor-pointer hover:opacity-80 transition-opacity" 
            onClick={() => navigate('/admin')}
          />
          <div className="text-left">
            <h1 className="text-xl font-bold">Print Settings</h1>
            <p className="text-sm text-muted-foreground">Printers & receipts</p>
          </div>
        </div>
      </AppHeader>

      <div className="p-6">
        <Tabs defaultValue="qztray" className="space-y-6">
          <TabsList>
            <TabsTrigger value="qztray" className="gap-2">
              <Usb className="h-4 w-4" />
              QZ Tray
            </TabsTrigger>
            <TabsTrigger value="printers" className="gap-2">
              <Printer className="h-4 w-4" />
              Network Printers
            </TabsTrigger>
            <TabsTrigger value="routing" className="gap-2">
              <Route className="h-4 w-4" />
              Routing Rules
            </TabsTrigger>
            <TabsTrigger value="branding" className="gap-2">
              <Image className="h-4 w-4" />
              Receipt Branding
            </TabsTrigger>
          </TabsList>

          {/* Printers Tab */}
          <TabsContent value="printers">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Network Printers</CardTitle>
                  <CardDescription>Configure printer destinations</CardDescription>
                </div>
                <Button onClick={() => openPrinterDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Printer
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : printers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No printers configured. Add a printer to get started.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {printers.map((printer) => (
                        <TableRow key={printer.id}>
                          <TableCell className="font-medium">{printer.name}</TableCell>
                          <TableCell className="font-mono text-sm">{printer.ip_address}</TableCell>
                          <TableCell>
                            <Badge variant={getPrinterTypeBadge(printer.printer_type)}>
                              {printer.printer_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={printer.is_active ? 'default' : 'outline'}
                              className="cursor-pointer"
                              onClick={() => togglePrinterActive(printer)}
                            >
                              {printer.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openPrinterDialog(printer)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeletePrinter(printer)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Routing Rules Tab */}
          <TabsContent value="routing">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Print Routing Rules</CardTitle>
                  <CardDescription>Route product categories to specific printers</CardDescription>
                </div>
                <Button onClick={openRoutingDialog} disabled={printers.length === 0}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rule
                </Button>
              </CardHeader>
              <CardContent>
                {printers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Add printers first before configuring routing rules.
                  </div>
                ) : routingRules.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No routing rules configured. All items will print to default printer.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Prints To</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {routingRules.map((rule) => (
                        <TableRow key={rule.id}>
                          <TableCell className="font-medium">{rule.category_name}</TableCell>
                          <TableCell>{rule.printer_name}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteRouting(rule)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Branding Tab */}
          <TabsContent value="branding">
            <Card>
              <CardHeader>
                <CardTitle>Receipt Branding</CardTitle>
                <CardDescription>Customize receipt appearance with logo and business info</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Logo Upload */}
                <div className="space-y-3">
                  <Label>Receipt Logo</Label>
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    <div className="border rounded-lg p-3 bg-muted/30">
                      {brandingForm.logo_url ? (
                        <img 
                          src={brandingForm.logo_url} 
                          alt="Custom Receipt Logo" 
                          className="h-20 w-auto object-contain"
                        />
                      ) : (
                        <img 
                          src="/casbah-logo-print.jpg" 
                          alt="Default Casbah Logo" 
                          className="h-20 w-auto object-contain"
                        />
                      )}
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        {brandingForm.logo_url ? 'Custom logo' : 'Default logo'}
                      </p>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          disabled={uploading}
                          className="max-w-xs"
                        />
                        {uploading && (
                          <span className="text-sm text-muted-foreground animate-pulse">Uploading...</span>
                        )}
                      </div>
                      {brandingForm.logo_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setBrandingForm(prev => ({ ...prev, logo_url: '' }))}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove custom logo (use default)
                        </Button>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Recommended: PNG or JPG, max 200x80px for best print quality on 80mm paper
                      </p>
                    </div>
                  </div>
                </div>

                {/* Business Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="business_name">Business Name</Label>
                    <Input
                      id="business_name"
                      value={brandingForm.business_name}
                      onChange={(e) => setBrandingForm(prev => ({ ...prev, business_name: e.target.value }))}
                      placeholder="Casbah Grill"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={brandingForm.phone}
                      onChange={(e) => setBrandingForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="065 683 5702"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address_line1">Address Line 1</Label>
                    <Input
                      id="address_line1"
                      value={brandingForm.address_line1}
                      onChange={(e) => setBrandingForm(prev => ({ ...prev, address_line1: e.target.value }))}
                      placeholder="194 Marine Drive"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address_line2">Address Line 2</Label>
                    <Input
                      id="address_line2"
                      value={brandingForm.address_line2}
                      onChange={(e) => setBrandingForm(prev => ({ ...prev, address_line2: e.target.value }))}
                      placeholder="Bluff, Durban"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="footer_text">Receipt Footer Text</Label>
                  <Input
                    id="footer_text"
                    value={brandingForm.footer_text}
                    onChange={(e) => setBrandingForm(prev => ({ ...prev, footer_text: e.target.value }))}
                    placeholder="Thank you for dining with us!"
                  />
                </div>

                <Button onClick={handleSaveBranding}>
                  Save Branding
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* QZ Tray Tab */}
          <TabsContent value="qztray">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Usb className="h-5 w-5" />
                  QZ Tray Configuration
                </CardTitle>
                <CardDescription>
                  Silent ESC/POS printing via QZ Tray. Prints directly to thermal printers without browser dialogs.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Connection Status */}
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    {qzConnected ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <div>
                      <p className="font-medium">
                        {qzConnected ? 'Connected to QZ Tray' : 'QZ Tray Not Connected'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {qzConnected 
                          ? 'Ready for silent printing' 
                          : 'Install and run QZ Tray from qz.io'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={initQZConnection}
                    disabled={qzLoading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${qzLoading ? 'animate-spin' : ''}`} />
                    {qzConnected ? 'Refresh' : 'Connect'}
                  </Button>
                </div>

                {!qzConnected && (
                  <Alert>
                    <AlertDescription>
                      <strong>To enable silent printing:</strong>
                      <ol className="list-decimal ml-4 mt-2 space-y-1 text-sm">
                        <li>Download and install QZ Tray from <a href="https://qz.io" target="_blank" rel="noopener noreferrer" className="text-primary underline">qz.io</a></li>
                        <li>Run QZ Tray on this computer</li>
                        <li>Click "Connect" above</li>
                        <li>When prompted, allow this site to access QZ Tray</li>
                      </ol>
                    </AlertDescription>
                  </Alert>
                )}

                {qzConnected && (
                  <>
                    {/* Printer Detection */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-medium">Detected Printers</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={refreshQZPrinters}
                          disabled={qzLoading}
                        >
                          <RefreshCw className={`h-4 w-4 mr-2 ${qzLoading ? 'animate-spin' : ''}`} />
                          Refresh
                        </Button>
                      </div>
                      {qzPrinters.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No printers detected. Make sure printers are installed on this computer.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {qzPrinters.map(printer => (
                            <Badge key={printer} variant="secondary">{printer}</Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Cashier Printer Selection */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-3 p-4 border rounded-lg">
                        <Label className="text-base font-medium">Cashier Printer (Customer Receipt)</Label>
                        <Select value={qzSelectedCashier} onValueChange={setQzSelectedCashier}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select cashier printer" />
                          </SelectTrigger>
                          <SelectContent>
                            {qzPrinters.map(printer => (
                              <SelectItem key={printer} value={printer}>{printer}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSaveQZPrinter('cashier', qzSelectedCashier)}
                            disabled={!qzSelectedCashier}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTestQZPrint(qzSelectedCashier)}
                            disabled={!qzSelectedCashier}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Test
                          </Button>
                        </div>
                        {qzConfig.cashier && (
                          <p className="text-sm text-muted-foreground">
                            Current: <span className="font-medium">{qzConfig.cashier}</span>
                          </p>
                        )}
                      </div>

                      {/* Kitchen Printer Selection */}
                      <div className="space-y-3 p-4 border rounded-lg">
                        <Label className="text-base font-medium">Kitchen Printer (Order Slip)</Label>
                        <Select value={qzSelectedKitchen} onValueChange={setQzSelectedKitchen}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select kitchen printer" />
                          </SelectTrigger>
                          <SelectContent>
                            {qzPrinters.map(printer => (
                              <SelectItem key={printer} value={printer}>{printer}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSaveQZPrinter('kitchen', qzSelectedKitchen)}
                            disabled={!qzSelectedKitchen}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTestQZPrint(qzSelectedKitchen)}
                            disabled={!qzSelectedKitchen}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Test
                          </Button>
                        </div>
                        {qzConfig.kitchen && (
                          <p className="text-sm text-muted-foreground">
                            Current: <span className="font-medium">{qzConfig.kitchen}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Info */}
                    <Alert>
                      <AlertDescription className="text-sm">
                        <strong>Silent Printing:</strong> Once configured, all completed transactions will automatically print to both printers without any dialog boxes. For this to work, you must allow site access in QZ Tray certificates settings.
                      </AlertDescription>
                    </Alert>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Printer Dialog */}
      <Dialog open={printerDialogOpen} onOpenChange={setPrinterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPrinter ? 'Edit Printer' : 'Add Printer'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="printerName">Printer Name</Label>
              <Input
                id="printerName"
                value={printerName}
                onChange={(e) => setPrinterName(e.target.value)}
                placeholder="Kitchen Printer"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="printerIp">IP Address</Label>
              <Input
                id="printerIp"
                value={printerIp}
                onChange={(e) => setPrinterIp(e.target.value)}
                placeholder="192.168.1.100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="printerType">Printer Type</Label>
              <Select value={printerType} onValueChange={(v: any) => setPrinterType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receipt">Receipt Printer</SelectItem>
                  <SelectItem value="kitchen">Kitchen Printer</SelectItem>
                  <SelectItem value="bar">Bar Printer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleSavePrinter}>
              Save Printer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Routing Dialog */}
      <Dialog open={routingDialogOpen} onOpenChange={setRoutingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Routing Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Product Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Print To</Label>
              <Select value={selectedPrinterId} onValueChange={setSelectedPrinterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select printer" />
                </SelectTrigger>
                <SelectContent>
                  {printers.filter(p => p.is_active).map(printer => (
                    <SelectItem key={printer.id} value={printer.id}>
                      {printer.name} ({printer.printer_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleSaveRouting}>
              Save Rule
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPrintSettings;