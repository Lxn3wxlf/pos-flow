import { useEffect, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/db';
import { useNetworkStatus } from './useNetworkStatus';
import { toast } from 'sonner';

export const useSyncEngine = (userId: string | undefined) => {
  const { isOnline, wasOffline } = useNetworkStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Sync products from cloud to local
  const syncProductsFromCloud = useCallback(async () => {
    if (!isOnline || !userId) return;

    try {
      const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      if (products) {
        await db.products.clear();
        await db.products.bulkAdd(
          products.map(p => ({
            ...p,
            synced_at: new Date()
          }))
        );
      }
    } catch (error) {
      console.error('Error syncing products from cloud:', error);
    }
  }, [isOnline, userId]);

  // Sync pending sales to cloud
  const syncSalesToCloud = useCallback(async () => {
    if (!isOnline || !userId) return;

    try {
      const allSales = await db.sales.toArray();
      const pendingSales = allSales.filter(s => !s.synced);

      for (const sale of pendingSales) {
        try {
          // Get sale items
          const saleItems = await db.sale_items.where('sale_id').equals(sale.id).toArray();

          // Insert sale to cloud
          const { data: cloudSale, error: saleError } = await supabase
            .from('sales')
            .insert({
              id: sale.id,
              cashier_id: sale.cashier_id,
              subtotal: sale.subtotal,
              tax_amount: sale.tax_amount,
              discount_amount: sale.discount_amount,
              total: sale.total,
              payment_method: sale.payment_method,
              notes: sale.notes,
              created_at: sale.created_at.toISOString(),
              synced_at: new Date().toISOString()
            })
            .select()
            .single();

          if (saleError) throw saleError;

          // Insert sale items
          const { error: itemsError } = await supabase
            .from('sale_items')
            .insert(
              saleItems.map(item => ({
                id: item.id,
                sale_id: item.sale_id,
                product_id: item.product_id,
                product_name: item.product_name,
                product_sku: item.product_sku,
                qty: item.qty,
                price_at_sale: item.price_at_sale,
                cost_at_sale: item.cost_at_sale,
                tax_rate: item.tax_rate,
                line_total: item.line_total
              }))
            );

          if (itemsError) throw itemsError;

          // Update stock quantities
          for (const item of saleItems) {
            const { data: product } = await supabase
              .from('products')
              .select('stock_qty')
              .eq('id', item.product_id)
              .single();

            if (product) {
              await supabase
                .from('products')
                .update({ stock_qty: product.stock_qty - item.qty })
                .eq('id', item.product_id);
            }
          }

          // Mark as synced in local DB
          await db.sales.update(sale.id, { synced: true, sync_attempts: 0 });
          
          console.log(`Sale ${sale.id} synced successfully`);
        } catch (error) {
          console.error(`Error syncing sale ${sale.id}:`, error);
          await db.sales.update(sale.id, { 
            sync_attempts: sale.sync_attempts + 1 
          });
        }
      }

      if (pendingSales.length > 0) {
        toast.success(`Synced ${pendingSales.length} sale(s) to cloud`);
      }
    } catch (error) {
      console.error('Error syncing sales to cloud:', error);
      toast.error('Failed to sync some sales');
    }
  }, [isOnline, userId]);

  // Main sync function
  const sync = useCallback(async () => {
    if (!isOnline || !userId || isSyncing) return;

    setIsSyncing(true);
    try {
      await Promise.all([
        syncProductsFromCloud(),
        syncSalesToCloud()
      ]);
      setLastSync(new Date());
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, userId, isSyncing, syncProductsFromCloud, syncSalesToCloud]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (wasOffline && isOnline) {
      console.log('Back online, triggering sync...');
      sync();
    }
  }, [wasOffline, isOnline, sync]);

  // Periodic sync every 5 minutes when online
  useEffect(() => {
    if (!isOnline || !userId) return;

    const interval = setInterval(() => {
      sync();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [isOnline, userId, sync]);

  // Initial sync on mount
  useEffect(() => {
    if (isOnline && userId) {
      sync();
    }
  }, [userId]); // Only on userId change

  return {
    sync,
    isSyncing,
    isOnline,
    lastSync
  };
};
