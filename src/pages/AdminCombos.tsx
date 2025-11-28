import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppHeader from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Edit, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  price: number;
}

interface Category {
  id: string;
  name: string;
}

interface ComboProduct {
  id: string;
  product_id: string;
  combo_description: string | null;
  products: Product;
}

interface ComboComponent {
  id: string;
  combo_product_id: string;
  component_name: string;
  category_id: string | null;
  qty: number;
  allows_substitution: boolean;
}

export default function AdminCombos() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [combos, setCombos] = useState<ComboProduct[]>([]);
  const [components, setComponents] = useState<ComboComponent[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [componentDialogOpen, setComponentDialogOpen] = useState(false);
  const [editingCombo, setEditingCombo] = useState<ComboProduct | null>(null);
  const [editingComponent, setEditingComponent] = useState<ComboComponent | null>(null);

  const [comboForm, setComboForm] = useState({
    product_id: '',
    combo_description: '',
  });

  const [componentForm, setComponentForm] = useState({
    combo_product_id: '',
    component_name: '',
    category_id: '',
    qty: 1,
    allows_substitution: true,
  });

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
      const [combosRes, componentsRes, productsRes, categoriesRes] = await Promise.all([
        supabase.from('combo_products').select('*, products(id, name, price)'),
        supabase.from('combo_components').select('*'),
        supabase.from('products').select('id, name, price').eq('is_active', true),
        supabase.from('categories').select('*'),
      ]);

      if (combosRes.error) throw combosRes.error;
      if (componentsRes.error) throw componentsRes.error;
      if (productsRes.error) throw productsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      setCombos(combosRes.data || []);
      setComponents(componentsRes.data || []);
      setProducts(productsRes.data || []);
      setCategories(categoriesRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load combos');
    } finally {
      setLoading(false);
    }
  };

  const handleComboSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCombo) {
        const { error } = await supabase
          .from('combo_products')
          .update({
            combo_description: comboForm.combo_description,
          })
          .eq('id', editingCombo.id);
        if (error) throw error;
        toast.success('Combo updated');
      } else {
        const { error } = await supabase
          .from('combo_products')
          .insert([comboForm]);
        if (error) throw error;
        toast.success('Combo created');
      }
      setDialogOpen(false);
      resetComboForm();
      loadData();
    } catch (error) {
      console.error('Error saving combo:', error);
      toast.error('Failed to save combo');
    }
  };

  const handleComponentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingComponent) {
        const { error } = await supabase
          .from('combo_components')
          .update(componentForm)
          .eq('id', editingComponent.id);
        if (error) throw error;
        toast.success('Component updated');
      } else {
        const { error } = await supabase
          .from('combo_components')
          .insert([componentForm]);
        if (error) throw error;
        toast.success('Component added');
      }
      setComponentDialogOpen(false);
      resetComponentForm();
      loadData();
    } catch (error) {
      console.error('Error saving component:', error);
      toast.error('Failed to save component');
    }
  };

  const handleDeleteCombo = async (id: string) => {
    if (!confirm('Delete this combo? This will also delete all its components.')) return;
    try {
      const { error } = await supabase.from('combo_products').delete().eq('id', id);
      if (error) throw error;
      toast.success('Combo deleted');
      loadData();
    } catch (error) {
      console.error('Error deleting combo:', error);
      toast.error('Failed to delete combo');
    }
  };

  const handleDeleteComponent = async (id: string) => {
    if (!confirm('Delete this component?')) return;
    try {
      const { error } = await supabase.from('combo_components').delete().eq('id', id);
      if (error) throw error;
      toast.success('Component deleted');
      loadData();
    } catch (error) {
      console.error('Error deleting component:', error);
      toast.error('Failed to delete component');
    }
  };

  const handleEditCombo = (combo: ComboProduct) => {
    setEditingCombo(combo);
    setComboForm({
      product_id: combo.product_id,
      combo_description: combo.combo_description || '',
    });
    setDialogOpen(true);
  };

  const handleEditComponent = (component: ComboComponent) => {
    setEditingComponent(component);
    setComponentForm({
      combo_product_id: component.combo_product_id,
      component_name: component.component_name,
      category_id: component.category_id || '',
      qty: component.qty,
      allows_substitution: component.allows_substitution,
    });
    setComponentDialogOpen(true);
  };

  const resetComboForm = () => {
    setEditingCombo(null);
    setComboForm({
      product_id: '',
      combo_description: '',
    });
  };

  const resetComponentForm = () => {
    setEditingComponent(null);
    setComponentForm({
      combo_product_id: '',
      component_name: '',
      category_id: '',
      qty: 1,
      allows_substitution: true,
    });
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader>
        <div className="flex items-center justify-between w-full">
          <h1 className="text-xl font-bold">Combo Meals</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetComboForm}>
                <Plus className="w-4 h-4 mr-2" />
                Create Combo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCombo ? 'Edit' : 'Create'} Combo
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleComboSubmit} className="space-y-4">
                <div>
                  <Label>Base Product</Label>
                  <Select
                    value={comboForm.product_id}
                    onValueChange={(value) =>
                      setComboForm({ ...comboForm, product_id: value })
                    }
                    disabled={!!editingCombo}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} - R{product.price.toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={comboForm.combo_description}
                    onChange={(e) =>
                      setComboForm({
                        ...comboForm,
                        combo_description: e.target.value,
                      })
                    }
                    placeholder="e.g., Includes burger, fries, and drink"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingCombo ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </AppHeader>

      <div className="container mx-auto p-6 space-y-6">
        {combos.map((combo) => (
          <Card key={combo.id} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">{combo.products.name}</h3>
                <p className="text-sm text-muted-foreground">
                  R{combo.products.price.toFixed(2)}
                </p>
                {combo.combo_description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {combo.combo_description}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditCombo(combo)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteCombo(combo.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="font-medium">Components</h4>
                <Dialog
                  open={componentDialogOpen}
                  onOpenChange={setComponentDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        resetComponentForm();
                        setComponentForm({
                          ...componentForm,
                          combo_product_id: combo.id,
                        });
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Component
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingComponent ? 'Edit' : 'Add'} Component
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleComponentSubmit} className="space-y-4">
                      <div>
                        <Label>Component Name</Label>
                        <Input
                          value={componentForm.component_name}
                          onChange={(e) =>
                            setComponentForm({
                              ...componentForm,
                              component_name: e.target.value,
                            })
                          }
                          placeholder="e.g., Main Item, Side, Drink"
                          required
                        />
                      </div>
                      <div>
                        <Label>Category (Optional)</Label>
                        <Select
                          value={componentForm.category_id}
                          onValueChange={(value) =>
                            setComponentForm({
                              ...componentForm,
                              category_id: value,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Any category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Any category</SelectItem>
                            {categories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          min="1"
                          value={componentForm.qty}
                          onChange={(e) =>
                            setComponentForm({
                              ...componentForm,
                              qty: parseInt(e.target.value) || 1,
                            })
                          }
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="substitution"
                          checked={componentForm.allows_substitution}
                          onCheckedChange={(checked) =>
                            setComponentForm({
                              ...componentForm,
                              allows_substitution: checked as boolean,
                            })
                          }
                        />
                        <label
                          htmlFor="substitution"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Allow substitutions
                        </label>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setComponentDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit">
                          {editingComponent ? 'Update' : 'Add'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid gap-2">
                {components
                  .filter((c) => c.combo_product_id === combo.id)
                  .map((component) => (
                    <div
                      key={component.id}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div>
                        <span className="font-medium">
                          {component.component_name}
                        </span>
                        <span className="ml-2 text-sm text-muted-foreground">
                          × {component.qty}
                        </span>
                        {component.category_id && (
                          <span className="ml-2 text-sm text-muted-foreground">
                            (
                            {
                              categories.find(
                                (c) => c.id === component.category_id
                              )?.name
                            }
                            )
                          </span>
                        )}
                        {component.allows_substitution && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            • Substitutions allowed
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditComponent(component)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteComponent(component.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                {components.filter((c) => c.combo_product_id === combo.id)
                  .length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No components yet. Add one above.
                  </p>
                )}
              </div>
            </div>
          </Card>
        ))}

        {combos.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              No combos yet. Create one to get started.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
