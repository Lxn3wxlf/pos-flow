import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppHeader from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Trash2, Edit, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface ModifierGroup {
  id: string;
  name: string;
  selection_type: 'single' | 'multiple';
  min_selections: number;
  max_selections: number | null;
  is_active: boolean;
}

interface Modifier {
  id: string;
  modifier_group_id: string;
  name: string;
  price_adjustment: number;
  is_available: boolean;
}

export default function AdminModifiers() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [modifierDialogOpen, setModifierDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ModifierGroup | null>(null);
  const [editingModifier, setEditingModifier] = useState<Modifier | null>(null);

  const [groupForm, setGroupForm] = useState({
    name: '',
    selection_type: 'multiple' as 'single' | 'multiple',
    min_selections: 0,
    max_selections: null as number | null,
  });

  const [modifierForm, setModifierForm] = useState({
    modifier_group_id: '',
    name: '',
    price_adjustment: 0,
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
      const [groupsRes, modifiersRes] = await Promise.all([
        supabase.from('modifier_groups').select('*').order('display_order'),
        supabase.from('modifiers').select('*').order('display_order'),
      ]);

      if (groupsRes.error) throw groupsRes.error;
      if (modifiersRes.error) throw modifiersRes.error;

      setGroups((groupsRes.data || []) as ModifierGroup[]);
      setModifiers((modifiersRes.data || []) as Modifier[]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load modifiers');
    } finally {
      setLoading(false);
    }
  };

  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingGroup) {
        const { error } = await supabase
          .from('modifier_groups')
          .update(groupForm)
          .eq('id', editingGroup.id);
        if (error) throw error;
        toast.success('Modifier group updated');
      } else {
        const { error } = await supabase
          .from('modifier_groups')
          .insert([groupForm]);
        if (error) throw error;
        toast.success('Modifier group created');
      }
      setDialogOpen(false);
      resetGroupForm();
      loadData();
    } catch (error) {
      console.error('Error saving group:', error);
      toast.error('Failed to save modifier group');
    }
  };

  const handleModifierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingModifier) {
        const { error } = await supabase
          .from('modifiers')
          .update(modifierForm)
          .eq('id', editingModifier.id);
        if (error) throw error;
        toast.success('Modifier updated');
      } else {
        const { error } = await supabase
          .from('modifiers')
          .insert([modifierForm]);
        if (error) throw error;
        toast.success('Modifier created');
      }
      setModifierDialogOpen(false);
      resetModifierForm();
      loadData();
    } catch (error) {
      console.error('Error saving modifier:', error);
      toast.error('Failed to save modifier');
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm('Delete this modifier group? This will also delete all modifiers in it.')) return;
    try {
      const { error } = await supabase.from('modifier_groups').delete().eq('id', id);
      if (error) throw error;
      toast.success('Modifier group deleted');
      loadData();
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error('Failed to delete modifier group');
    }
  };

  const handleDeleteModifier = async (id: string) => {
    if (!confirm('Delete this modifier?')) return;
    try {
      const { error } = await supabase.from('modifiers').delete().eq('id', id);
      if (error) throw error;
      toast.success('Modifier deleted');
      loadData();
    } catch (error) {
      console.error('Error deleting modifier:', error);
      toast.error('Failed to delete modifier');
    }
  };

  const handleEditGroup = (group: ModifierGroup) => {
    setEditingGroup(group);
    setGroupForm({
      name: group.name,
      selection_type: group.selection_type,
      min_selections: group.min_selections,
      max_selections: group.max_selections,
    });
    setDialogOpen(true);
  };

  const handleEditModifier = (modifier: Modifier) => {
    setEditingModifier(modifier);
    setModifierForm({
      modifier_group_id: modifier.modifier_group_id,
      name: modifier.name,
      price_adjustment: modifier.price_adjustment,
    });
    setModifierDialogOpen(true);
  };

  const resetGroupForm = () => {
    setEditingGroup(null);
    setGroupForm({
      name: '',
      selection_type: 'multiple',
      min_selections: 0,
      max_selections: null,
    });
  };

  const resetModifierForm = () => {
    setEditingModifier(null);
    setModifierForm({
      modifier_group_id: '',
      name: '',
      price_adjustment: 0,
    });
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader>
        <div className="flex items-center justify-between w-full">
          <h1 className="text-xl font-bold">Product Modifiers</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetGroupForm}>
                <Plus className="w-4 h-4 mr-2" />
                Add Group
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingGroup ? 'Edit' : 'Add'} Modifier Group
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleGroupSubmit} className="space-y-4">
                <div>
                  <Label>Group Name</Label>
                  <Input
                    value={groupForm.name}
                    onChange={(e) =>
                      setGroupForm({ ...groupForm, name: e.target.value })
                    }
                    placeholder="e.g., Toppings, Size, Extras"
                    required
                  />
                </div>
                <div>
                  <Label>Selection Type</Label>
                  <Select
                    value={groupForm.selection_type}
                    onValueChange={(value: 'single' | 'multiple') =>
                      setGroupForm({ ...groupForm, selection_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single Choice</SelectItem>
                      <SelectItem value="multiple">Multiple Choice</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Min Selections</Label>
                    <Input
                      type="number"
                      min="0"
                      value={groupForm.min_selections}
                      onChange={(e) =>
                        setGroupForm({
                          ...groupForm,
                          min_selections: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Max Selections</Label>
                    <Input
                      type="number"
                      min="0"
                      value={groupForm.max_selections || ''}
                      onChange={(e) =>
                        setGroupForm({
                          ...groupForm,
                          max_selections: e.target.value
                            ? parseInt(e.target.value)
                            : null,
                        })
                      }
                      placeholder="Unlimited"
                    />
                  </div>
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
                    {editingGroup ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </AppHeader>

      <div className="container mx-auto p-6 space-y-6">
        {groups.map((group) => (
          <Card key={group.id} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">{group.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {group.selection_type === 'single' ? 'Single' : 'Multiple'} •
                  Min: {group.min_selections} • Max:{' '}
                  {group.max_selections || 'Unlimited'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditGroup(group)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteGroup(group.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="font-medium">Modifiers</h4>
                <Dialog
                  open={modifierDialogOpen}
                  onOpenChange={setModifierDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        resetModifierForm();
                        setModifierForm({
                          ...modifierForm,
                          modifier_group_id: group.id,
                        });
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Modifier
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingModifier ? 'Edit' : 'Add'} Modifier
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleModifierSubmit} className="space-y-4">
                      <div>
                        <Label>Modifier Name</Label>
                        <Input
                          value={modifierForm.name}
                          onChange={(e) =>
                            setModifierForm({
                              ...modifierForm,
                              name: e.target.value,
                            })
                          }
                          placeholder="e.g., Extra Cheese, Large, No Salt"
                          required
                        />
                      </div>
                      <div>
                        <Label>Price Adjustment (R)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={modifierForm.price_adjustment}
                          onChange={(e) =>
                            setModifierForm({
                              ...modifierForm,
                              price_adjustment:
                                parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder="0.00"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setModifierDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit">
                          {editingModifier ? 'Update' : 'Create'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid gap-2">
                {modifiers
                  .filter((m) => m.modifier_group_id === group.id)
                  .map((modifier) => (
                    <div
                      key={modifier.id}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div>
                        <span className="font-medium">{modifier.name}</span>
                        {modifier.price_adjustment !== 0 && (
                          <span className="ml-2 text-sm text-muted-foreground">
                            {modifier.price_adjustment > 0 ? '+' : ''}R
                            {modifier.price_adjustment.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditModifier(modifier)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteModifier(modifier.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                {modifiers.filter((m) => m.modifier_group_id === group.id)
                  .length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No modifiers yet. Add one above.
                  </p>
                )}
              </div>
            </div>
          </Card>
        ))}

        {groups.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              No modifier groups yet. Create one to get started.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
