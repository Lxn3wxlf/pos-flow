import Dexie, { Table } from 'dexie';

// IndexedDB schema for offline storage
export interface LocalProduct {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  cost: number;
  tax_rate: number;
  stock_qty: number;
  category_id?: string;
  is_active: boolean;
  image_url?: string;
  synced_at: Date;
  pricing_type?: string;
  price_per_unit?: number;
  unit_type?: string;
  kitchen_station?: string;
  estimated_prep_minutes?: number;
}

export interface LocalSale {
  id: string;
  cashier_id: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  payment_method: string;
  notes?: string;
  created_at: Date;
  synced: boolean;
  sync_attempts: number;
}

export interface LocalSaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  qty: number;
  price_at_sale: number;
  cost_at_sale: number;
  tax_rate: number;
  line_total: number;
}

export interface SyncQueue {
  id?: number;
  type: 'sale' | 'product' | 'inventory';
  data: any;
  attempts: number;
  created_at: Date;
  last_attempt?: Date;
  error?: string;
}

// Delete database using native API (more reliable for corrupted DBs)
const deleteDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('POSDatabase');
    request.onsuccess = () => {
      console.log('[DB] Database deleted successfully');
      resolve();
    };
    request.onerror = () => {
      console.error('[DB] Failed to delete database');
      reject(request.error);
    };
    request.onblocked = () => {
      console.warn('[DB] Database deletion blocked - closing connections');
      resolve();
    };
  });
};

export class POSDatabase extends Dexie {
  products!: Table<LocalProduct, string>;
  sales!: Table<LocalSale, string>;
  sale_items!: Table<LocalSaleItem, string>;
  sync_queue!: Table<SyncQueue, number>;

  constructor() {
    super('POSDatabase');
    
    this.version(1).stores({
      products: 'id, sku, barcode, synced_at',
      sales: 'id, cashier_id, created_at, synced',
      sale_items: 'id, sale_id, product_id',
      sync_queue: '++id, type, created_at, attempts'
    });

    // Handle database errors globally
    this.on('blocked', () => {
      console.warn('[DB] Database blocked - another connection is open');
    });
  }
}

export let db = new POSDatabase();

// Initialize database with error recovery
export const initDatabase = async (): Promise<boolean> => {
  try {
    await db.open();
    // Test if we can actually query
    await db.products.count();
    console.log('[DB] Database initialized successfully');
    return true;
  } catch (error) {
    console.error('[DB] Database initialization failed, attempting recovery:', error);
    try {
      // Close any existing connections
      db.close();
      // Delete corrupted database
      await deleteDatabase();
      // Create fresh instance
      db = new POSDatabase();
      await db.open();
      console.log('[DB] Database recovered successfully');
      return true;
    } catch (recoveryError) {
      console.error('[DB] Database recovery failed:', recoveryError);
      return false;
    }
  }
};

// Clear sync queue to fix corrupted data issues
export const clearSyncQueue = async () => {
  try {
    if (db.isOpen()) {
      await db.sync_queue.clear();
      console.log('[DB] Sync queue cleared');
    }
  } catch (error) {
    console.error('[DB] Failed to clear sync queue:', error);
  }
};

// Reset database completely
export const resetDatabase = async () => {
  try {
    db.close();
    await deleteDatabase();
    db = new POSDatabase();
    await db.open();
    console.log('[DB] Database reset complete');
  } catch (error) {
    console.error('[DB] Failed to reset database:', error);
    throw error;
  }
};
