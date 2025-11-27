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
  synced_at: Date;
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
  }
}

export const db = new POSDatabase();
