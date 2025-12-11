import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Search, Plus, Trash2 } from 'lucide-react';
import { customerSchema, deliveryAddressSchema, validateForm, getFirstError } from '@/lib/validations';

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock_qty: number;
}

interface OrderItem {
  product: Product;
  qty: number;
}

const NewDelivery = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  
  // Customer info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  
  // Address info
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('35');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!profile) {
      navigate('/auth');
      return;
    }

    if (!profile.roles?.includes('admin') && !profile.roles?.includes('waiter')) {
      toast.error('Access denied');
      navigate('/');
      return;
    }

    fetchProducts();
  }, [profile, navigate]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    }
  };

  const addItem = (product: Product) => {
    const existing = orderItems.find(item => item.product.id === product.id);
    if (existing) {
      setOrderItems(orderItems.map(item =>
        item.product.id === product.id
          ? { ...item, qty: item.qty + 1 }
          : item
      ));
    } else {
      setOrderItems([...orderItems, { product, qty: 1 }]);
    }
    setSearchQuery('');
  };

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      setOrderItems(orderItems.filter(item => item.product.id !== productId));
    } else {
      setOrderItems(orderItems.map(item =>
        item.product.id === productId ? { ...item, qty } : item
      ));
    }
  };

  const calculateSubtotal = () => {
    return orderItems.reduce((sum, item) => sum + (item.product.price * item.qty), 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + parseFloat(deliveryFee || '0');
  };

  const submitOrder = async () => {
    setErrors({});
    
    // Validate customer data
    const customerValidation = validateForm(customerSchema, {
      name: customerName,
      phone: customerPhone,
      email: customerEmail || undefined,
    });
    
    if (customerValidation.success === false) {
      setErrors(customerValidation.errors);
      toast.error(getFirstError(customerValidation.errors));
      return;
    }
    
    // Validate address data
    const addressValidation = validateForm(deliveryAddressSchema, {
      addressLine1,
      addressLine2: addressLine2 || undefined,
      city,
      postalCode,
      deliveryNotes: deliveryNotes || undefined,
      deliveryFee: parseFloat(deliveryFee || '0'),
    });
    
    if (addressValidation.success === false) {
      setErrors(addressValidation.errors);
      toast.error(getFirstError(addressValidation.errors));
      return;
    }

    if (orderItems.length === 0) {
      toast.error('Please add items to the order');
      return;
    }

    setSubmitting(true);

    try {
      // 1. Create or get customer
      let customerId: string;
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', customerPhone)
        .single();

      if (existingCustomer) {
        customerId = existingCustomer.id;
        // Update customer info
        await supabase
          .from('customers')
          .update({ name: customerName, email: customerEmail })
          .eq('id', customerId);
      } else {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            name: customerName,
            phone: customerPhone,
            email: customerEmail,
          })
          .select()
          .single();

        if (customerError) throw customerError;
        customerId = newCustomer.id;
      }

      // 2. Create delivery address
      const { data: address, error: addressError } = await supabase
        .from('delivery_addresses')
        .insert({
          customer_id: customerId,
          address_line1: addressLine1,
          address_line2: addressLine2,
          city: city,
          postal_code: postalCode,
          is_default: false,
        })
        .select()
        .single();

      if (addressError) throw addressError;

      // 3. Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: `ORD-${Date.now()}`,
          order_type: 'delivery',
          customer_name: customerName,
          status: 'pending',
          waiter_id: profile?.id,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 4. Create order items
      const orderItemsData = orderItems.map(item => ({
        order_id: order.id,
        product_id: item.product.id,
        product_name: item.product.name,
        product_sku: item.product.sku,
        qty: item.qty,
        price_at_order: item.product.price,
        cost_at_order: 0,
        tax_rate: 0,
        line_total: item.product.price * item.qty,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsData);

      if (itemsError) throw itemsError;

      // 5. Create delivery assignment
      const estimatedDelivery = new Date();
      estimatedDelivery.setMinutes(estimatedDelivery.getMinutes() + 45);

      const { error: deliveryError } = await supabase
        .from('delivery_assignments')
        .insert({
          order_id: order.id,
          customer_id: customerId,
          delivery_address_id: address.id,
          delivery_fee: parseFloat(deliveryFee || '0'),
          delivery_notes: deliveryNotes,
          estimated_delivery: estimatedDelivery.toISOString(),
          status: 'pending',
        });

      if (deliveryError) throw deliveryError;

      toast.success('Delivery order created successfully!');
      navigate('/delivery');
    } catch (error: any) {
      console.error('Error creating delivery order:', error);
      toast.error('Failed to create delivery order');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <AppHeader>
        <h1 className="text-2xl font-bold text-center">New Delivery Order</h1>
      </AppHeader>

      <div className="p-4 space-y-6 max-w-4xl mx-auto">
        {/* Customer Information */}
        <Card className="p-4 space-y-4">
          <h2 className="text-lg font-semibold">Customer Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer name"
              />
            </div>
            <div>
              <Label>Phone *</Label>
              <Input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Phone number"
              />
            </div>
            <div className="col-span-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="Email (optional)"
              />
            </div>
          </div>
        </Card>

        {/* Delivery Address */}
        <Card className="p-4 space-y-4">
          <h2 className="text-lg font-semibold">Delivery Address</h2>
          <div className="space-y-4">
            <div>
              <Label>Address Line 1 *</Label>
              <Input
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="Street address"
              />
            </div>
            <div>
              <Label>Address Line 2</Label>
              <Input
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                placeholder="Apt, suite, etc. (optional)"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>City *</Label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                />
              </div>
              <div>
                <Label>Postal Code *</Label>
                <Input
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="Postal code"
                />
              </div>
            </div>
            <div>
              <Label>Delivery Notes</Label>
              <Textarea
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder="Special delivery instructions"
              />
            </div>
            <div>
              <Label>Delivery Fee *</Label>
              <Input
                type="number"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value)}
                placeholder="Delivery fee"
              />
            </div>
          </div>
        </Card>

        {/* Products */}
        <Card className="p-4 space-y-4">
          <h2 className="text-lg font-semibold">Order Items</h2>
          
          {/* Product Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="pl-9"
            />
          </div>

          {/* Search Results */}
          {searchQuery && (
            <div className="border rounded-lg max-h-60 overflow-y-auto">
              {filteredProducts.map(product => (
                <div
                  key={product.id}
                  className="p-3 hover:bg-accent cursor-pointer border-b last:border-b-0"
                  onClick={() => addItem(product)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">{product.sku}</p>
                    </div>
                    <p className="font-semibold">R{product.price.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Cart Items */}
          <div className="space-y-2">
            {orderItems.map(item => (
              <div key={item.product.id} className="flex items-center gap-3 p-3 border rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">{item.product.name}</p>
                  <p className="text-sm text-muted-foreground">
                    R{item.product.price.toFixed(2)} each
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateQty(item.product.id, item.qty - 1)}
                  >
                    -
                  </Button>
                  <span className="w-8 text-center">{item.qty}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateQty(item.product.id, item.qty + 1)}
                  >
                    +
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => updateQty(item.product.id, 0)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="font-semibold w-24 text-right">
                  R{(item.product.price * item.qty).toFixed(2)}
                </p>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-semibold">R{calculateSubtotal().toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Delivery Fee:</span>
              <span className="font-semibold">R{parseFloat(deliveryFee || '0').toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total:</span>
              <span>R{calculateTotal().toFixed(2)}</span>
            </div>
          </div>
        </Card>

        {/* Submit Button */}
        <Button
          onClick={submitOrder}
          disabled={submitting}
          className="w-full"
          size="lg"
        >
          {submitting ? 'Creating Order...' : 'Create Delivery Order'}
        </Button>
      </div>
    </div>
  );
};

export default NewDelivery;