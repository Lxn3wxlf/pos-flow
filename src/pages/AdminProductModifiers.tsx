import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppHeader from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

interface Product {
  id: string;
  name: string;
}

interface ModifierGroup {
  id: string;
  name: string;
}

interface ProductModifier {
  product_id: string;
  modifier_group_id: string;
  is_required: boolean;
}

export default function AdminProductModifiers() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [productModifiers, setProductModifiers] = useState<ProductModifier[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!profile?.roles?.includes('admin')) {
      navigate('/');
      return;
    }
    loadData();
  }, [user, profile]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [productsRes, groupsRes, linkRes] = await Promise.all([
        supabase.from('products').select('id, name').eq('is_active', true).order('name'),
        supabase.from('modifier_groups').select('id, name').eq('is_active', true).order('name'),
        supabase.from('product_modifiers').select('*'),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (groupsRes.error) throw groupsRes.error;
      if (linkRes.error) throw linkRes.error;

      setProducts(productsRes.data || []);
      setModifierGroups(groupsRes.data || []);
      setProductModifiers(linkRes.data || []);
      
      if (productsRes.data && productsRes.data.length > 0) {
        setSelectedProduct(productsRes.data[0].id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const isGroupLinked = (productId: string, groupId: string) => {
    return productModifiers.some(
      pm => pm.product_id === productId && pm.modifier_group_id === groupId
    );
  };

  const isGroupRequired = (productId: string, groupId: string) => {
    const link = productModifiers.find(
      pm => pm.product_id === productId && pm.modifier_group_id === groupId
    );
    return link?.is_required || false;
  };

  const toggleGroupLink = async (productId: string, groupId: string) => {
    const isLinked = isGroupLinked(productId, groupId);

    try {
      if (isLinked) {
        const { error } = await supabase
          .from('product_modifiers')
          .delete()
          .eq('product_id', productId)
          .eq('modifier_group_id', groupId);
        if (error) throw error;
        toast.success('Modifier group removed');
      } else {
        const { error } = await supabase
          .from('product_modifiers')
          .insert([{
            product_id: productId,
            modifier_group_id: groupId,
            is_required: false,
          }]);
        if (error) throw error;
        toast.success('Modifier group added');
      }
      loadData();
    } catch (error) {
      console.error('Error toggling link:', error);
      toast.error('Failed to update link');
    }
  };

  const toggleRequired = async (productId: string, groupId: string) => {
    try {
      const currentRequired = isGroupRequired(productId, groupId);
      const { error } = await supabase
        .from('product_modifiers')
        .update({ is_required: !currentRequired })
        .eq('product_id', productId)
        .eq('modifier_group_id', groupId);
      if (error) throw error;
      toast.success(`Marked as ${!currentRequired ? 'required' : 'optional'}`);
      loadData();
    } catch (error) {
      console.error('Error updating required:', error);
      toast.error('Failed to update');
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  const currentProduct = products.find(p => p.id === selectedProduct);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader>
        <div className="flex items-center justify-center">
          <h1 className="text-xl font-bold">Link Modifiers to Products</h1>
        </div>
      </AppHeader>

      <div className="container mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Product List */}
          <Card className="lg:col-span-1 p-4">
            <h3 className="font-semibold mb-4">Products</h3>
            <div className="space-y-2">
              {products.map(product => (
                <Button
                  key={product.id}
                  variant={selectedProduct === product.id ? 'default' : 'ghost'}
                  className="w-full justify-start"
                  onClick={() => setSelectedProduct(product.id)}
                >
                  {product.name}
                  {productModifiers.filter(pm => pm.product_id === product.id).length > 0 && (
                    <Badge variant="secondary" className="ml-auto">
                      {productModifiers.filter(pm => pm.product_id === product.id).length}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          </Card>

          {/* Modifier Groups */}
          <Card className="lg:col-span-3 p-6">
            <h3 className="font-semibold mb-4">
              Modifier Groups for: {currentProduct?.name}
            </h3>
            
            {modifierGroups.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No modifier groups available. Create some first.
              </p>
            ) : (
              <div className="space-y-4">
                {modifierGroups.map(group => {
                  const isLinked = selectedProduct ? isGroupLinked(selectedProduct, group.id) : false;
                  const isRequired = selectedProduct ? isGroupRequired(selectedProduct, group.id) : false;

                  return (
                    <Card key={group.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <Checkbox
                            checked={isLinked}
                            onCheckedChange={() => selectedProduct && toggleGroupLink(selectedProduct, group.id)}
                          />
                          <div>
                            <p className="font-medium">{group.name}</p>
                            {isLinked && (
                              <p className="text-xs text-muted-foreground">
                                {isRequired ? 'Required' : 'Optional'}
                              </p>
                            )}
                          </div>
                        </div>
                        {isLinked && (
                          <Button
                            variant={isRequired ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => selectedProduct && toggleRequired(selectedProduct, group.id)}
                          >
                            {isRequired ? 'Required' : 'Optional'}
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
