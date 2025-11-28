import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface ModifierGroup {
  id: string;
  name: string;
  selection_type: 'single' | 'multiple';
  min_selections: number;
  max_selections: number | null;
  is_required: boolean;
}

interface Modifier {
  id: string;
  modifier_group_id: string;
  name: string;
  price_adjustment: number;
}

export interface SelectedModifier {
  modifier_id: string;
  modifier_name: string;
  price_adjustment: number;
}

interface ModifierSelectorProps {
  productId: string;
  open: boolean;
  onClose: () => void;
  onConfirm: (modifiers: SelectedModifier[], totalAdjustment: number) => void;
}

export default function ModifierSelector({
  productId,
  open,
  onClose,
  onConfirm,
}: ModifierSelectorProps) {
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [selections, setSelections] = useState<Map<string, Set<string>>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      loadModifiers();
    }
  }, [open, productId]);

  const loadModifiers = async () => {
    setLoading(true);
    try {
      const { data: productModifiers, error: pmError } = await supabase
        .from('product_modifiers')
        .select('modifier_group_id, is_required')
        .eq('product_id', productId);

      if (pmError) throw pmError;

      if (!productModifiers || productModifiers.length === 0) {
        setModifierGroups([]);
        setModifiers([]);
        setLoading(false);
        return;
      }

      const groupIds = productModifiers.map(pm => pm.modifier_group_id);

      const [groupsRes, modsRes] = await Promise.all([
        supabase
          .from('modifier_groups')
          .select('*')
          .in('id', groupIds)
          .eq('is_active', true),
        supabase
          .from('modifiers')
          .select('*')
          .in('modifier_group_id', groupIds)
          .eq('is_available', true),
      ]);

      if (groupsRes.error) throw groupsRes.error;
      if (modsRes.error) throw modsRes.error;

      const groupsWithRequired = (groupsRes.data || []).map(group => ({
        ...group,
        is_required: productModifiers.find(pm => pm.modifier_group_id === group.id)?.is_required || false,
      })) as ModifierGroup[];

      setModifierGroups(groupsWithRequired);
      setModifiers(modsRes.data || []);
      
      // Initialize selections
      const newSelections = new Map<string, Set<string>>();
      groupsWithRequired.forEach(group => {
        newSelections.set(group.id, new Set());
      });
      setSelections(newSelections);
    } catch (error) {
      console.error('Error loading modifiers:', error);
      toast.error('Failed to load modifiers');
    } finally {
      setLoading(false);
    }
  };

  const toggleModifier = (groupId: string, modifierId: string, isSingleChoice: boolean) => {
    const newSelections = new Map(selections);
    const groupSelections = newSelections.get(groupId) || new Set();

    if (isSingleChoice) {
      groupSelections.clear();
      groupSelections.add(modifierId);
    } else {
      if (groupSelections.has(modifierId)) {
        groupSelections.delete(modifierId);
      } else {
        groupSelections.add(modifierId);
      }
    }

    newSelections.set(groupId, groupSelections);
    setSelections(newSelections);
  };

  const validateSelections = (): boolean => {
    for (const group of modifierGroups) {
      const selected = selections.get(group.id)?.size || 0;

      if (group.is_required && selected < group.min_selections) {
        toast.error(`${group.name} requires at least ${group.min_selections} selection(s)`);
        return false;
      }

      if (group.max_selections && selected > group.max_selections) {
        toast.error(`${group.name} allows maximum ${group.max_selections} selection(s)`);
        return false;
      }
    }
    return true;
  };

  const handleConfirm = () => {
    if (!validateSelections()) return;

    const selectedModifiers: SelectedModifier[] = [];
    let totalAdjustment = 0;

    selections.forEach((modifierIds, groupId) => {
      modifierIds.forEach(modifierId => {
        const modifier = modifiers.find(m => m.id === modifierId);
        if (modifier) {
          selectedModifiers.push({
            modifier_id: modifier.id,
            modifier_name: modifier.name,
            price_adjustment: modifier.price_adjustment,
          });
          totalAdjustment += modifier.price_adjustment;
        }
      });
    });

    onConfirm(selectedModifiers, totalAdjustment);
    onClose();
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Loading modifiers...</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  if (modifierGroups.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>No Modifiers Available</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">This product has no modifiers configured.</p>
          <DialogFooter>
            <Button onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customize Your Order</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {modifierGroups.map(group => {
            const groupModifiers = modifiers.filter(m => m.modifier_group_id === group.id);
            const selected = selections.get(group.id) || new Set();

            return (
              <div key={group.id} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold">{group.name}</h4>
                  {group.is_required && <Badge variant="destructive">Required</Badge>}
                  {group.selection_type === 'single' && (
                    <Badge variant="secondary">Choose 1</Badge>
                  )}
                  {group.selection_type === 'multiple' && (
                    <Badge variant="secondary">
                      {group.max_selections ? `Choose up to ${group.max_selections}` : 'Choose any'}
                    </Badge>
                  )}
                </div>

                {group.selection_type === 'single' ? (
                  <RadioGroup
                    value={Array.from(selected)[0] || ''}
                    onValueChange={(value) => toggleModifier(group.id, value, true)}
                  >
                    {groupModifiers.map(modifier => (
                      <div key={modifier.id} className="flex items-center space-x-2">
                        <RadioGroupItem value={modifier.id} id={modifier.id} />
                        <Label htmlFor={modifier.id} className="flex-1 cursor-pointer">
                          {modifier.name}
                          {modifier.price_adjustment !== 0 && (
                            <span className="ml-2 text-sm text-muted-foreground">
                              {modifier.price_adjustment > 0 ? '+' : ''}R{modifier.price_adjustment.toFixed(2)}
                            </span>
                          )}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <div className="space-y-2">
                    {groupModifiers.map(modifier => (
                      <div key={modifier.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={modifier.id}
                          checked={selected.has(modifier.id)}
                          onCheckedChange={() => toggleModifier(group.id, modifier.id, false)}
                        />
                        <Label htmlFor={modifier.id} className="flex-1 cursor-pointer">
                          {modifier.name}
                          {modifier.price_adjustment !== 0 && (
                            <span className="ml-2 text-sm text-muted-foreground">
                              {modifier.price_adjustment > 0 ? '+' : ''}R{modifier.price_adjustment.toFixed(2)}
                            </span>
                          )}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
