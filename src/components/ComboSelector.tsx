import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface ComboComponent {
  id: string;
  component_name: string;
  category_id: string | null;
  qty: number;
  allows_substitution: boolean;
}

interface Product {
  id: string;
  name: string;
  category_id: string | null;
}

export interface ComboSelection {
  combo_component_id: string;
  selected_product_id: string;
  selected_product_name: string;
  qty: number;
}

interface ComboSelectorProps {
  comboProductId: string;
  open: boolean;
  onClose: () => void;
  onConfirm: (selections: ComboSelection[]) => void;
}

export default function ComboSelector({
  comboProductId,
  open,
  onClose,
  onConfirm,
}: ComboSelectorProps) {
  const [components, setComponents] = useState<ComboComponent[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selections, setSelections] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      loadComboData();
    }
  }, [open, comboProductId]);

  const loadComboData = async () => {
    setLoading(true);
    try {
      const { data: comboData, error: comboError } = await supabase
        .from('combo_products')
        .select('id')
        .eq('product_id', comboProductId)
        .single();

      if (comboError) throw comboError;
      if (!comboData) {
        setComponents([]);
        setLoading(false);
        return;
      }

      const [componentsRes, productsRes] = await Promise.all([
        supabase
          .from('combo_components')
          .select('*')
          .eq('combo_product_id', comboData.id),
        supabase
          .from('products')
          .select('id, name, category_id')
          .eq('is_active', true),
      ]);

      if (componentsRes.error) throw componentsRes.error;
      if (productsRes.error) throw productsRes.error;

      setComponents(componentsRes.data || []);
      setProducts(productsRes.data || []);

      // Initialize selections with first available product for each component
      const initialSelections = new Map<string, string>();
      (componentsRes.data || []).forEach(component => {
        const availableProducts = getAvailableProducts(component);
        if (availableProducts.length > 0) {
          initialSelections.set(component.id, availableProducts[0].id);
        }
      });
      setSelections(initialSelections);
    } catch (error) {
      console.error('Error loading combo data:', error);
      toast.error('Failed to load combo options');
    } finally {
      setLoading(false);
    }
  };

  const getAvailableProducts = (component: ComboComponent): Product[] => {
    if (component.category_id) {
      return products.filter(p => p.category_id === component.category_id);
    }
    return products;
  };

  const handleSelectionChange = (componentId: string, productId: string) => {
    const newSelections = new Map(selections);
    newSelections.set(componentId, productId);
    setSelections(newSelections);
  };

  const validateSelections = (): boolean => {
    for (const component of components) {
      if (!selections.has(component.id)) {
        toast.error(`Please select a ${component.component_name}`);
        return false;
      }
    }
    return true;
  };

  const handleConfirm = () => {
    if (!validateSelections()) return;

    const comboSelections: ComboSelection[] = [];
    
    selections.forEach((productId, componentId) => {
      const component = components.find(c => c.id === componentId);
      const product = products.find(p => p.id === productId);
      
      if (component && product) {
        comboSelections.push({
          combo_component_id: component.id,
          selected_product_id: product.id,
          selected_product_name: product.name,
          qty: component.qty,
        });
      }
    });

    onConfirm(comboSelections);
    onClose();
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Loading combo options...</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  if (components.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Not a Combo</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">This product is not configured as a combo meal.</p>
          <DialogFooter>
            <Button onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Customize Your Combo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {components.map(component => {
            const availableProducts = getAvailableProducts(component);
            const selectedProductId = selections.get(component.id);

            return (
              <div key={component.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>{component.component_name}</Label>
                  <Badge variant="secondary">×{component.qty}</Badge>
                  {!component.allows_substitution && (
                    <Badge variant="outline">Fixed</Badge>
                  )}
                </div>

                {component.allows_substitution ? (
                  <Select
                    value={selectedProductId}
                    onValueChange={(value) => handleSelectionChange(component.id, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProducts.map(product => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-2 border rounded bg-muted">
                    <p className="text-sm">
                      {availableProducts.find(p => p.id === selectedProductId)?.name || 'Standard option'}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm}>Confirm Combo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
