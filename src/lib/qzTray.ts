/**
 * QZ Tray Integration for Silent ESC/POS Printing
 * Supports GTP-180 and other ESC/POS compatible thermal printers
 */

import { supabase } from '@/integrations/supabase/client';

// Declare QZ Tray global
declare global {
  interface Window {
    qz: any;
  }
}

// QZ Tray connection status
let isConnected = false;
let connectionPromise: Promise<void> | null = null;

/**
 * Initialize QZ Tray connection
 */
export const initQZTray = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !window.qz) {
    console.warn('[QZ Tray] QZ Tray library not loaded');
    return false;
  }

  if (isConnected && window.qz.websocket.isActive()) {
    return true;
  }

  // Prevent multiple connection attempts
  if (connectionPromise) {
    await connectionPromise;
    return isConnected;
  }

  connectionPromise = (async () => {
    try {
      if (!window.qz.websocket.isActive()) {
        await window.qz.websocket.connect();
        console.log('[QZ Tray] Connected successfully');
        isConnected = true;
      }
    } catch (err) {
      console.error('[QZ Tray] Connection error:', err);
      isConnected = false;
    } finally {
      connectionPromise = null;
    }
  })();

  await connectionPromise;
  return isConnected;
};

/**
 * Check if QZ Tray is connected
 */
export const isQZConnected = (): boolean => {
  return typeof window !== 'undefined' && window.qz && window.qz.websocket.isActive();
};

/**
 * Disconnect from QZ Tray
 */
export const disconnectQZTray = async (): Promise<void> => {
  if (typeof window !== 'undefined' && window.qz && window.qz.websocket.isActive()) {
    await window.qz.websocket.disconnect();
    isConnected = false;
    console.log('[QZ Tray] Disconnected');
  }
};

/**
 * List available printers
 */
export const listPrinters = async (): Promise<string[]> => {
  if (!await initQZTray()) {
    return [];
  }

  try {
    const printers = await window.qz.printers.find();
    console.log('[QZ Tray] Found printers:', printers);
    return printers;
  } catch (err) {
    console.error('[QZ Tray] Error listing printers:', err);
    return [];
  }
};

/**
 * Create printer configuration
 */
export const createPrinterConfig = (printerName: string) => {
  if (!window.qz) return null;
  
  return window.qz.configs.create(printerName, {
    size: { width: 80, height: 0 },
    copies: 1,
    density: 'normal',
    colorType: 'blackwhite',
  });
};

/**
 * ESC/POS Commands
 */
const ESC = '\x1B';
const GS = '\x1D';
const ESCPOS = {
  RESET: `${ESC}@`,
  CENTER: `${ESC}a\x01`,
  LEFT: `${ESC}a\x00`,
  RIGHT: `${ESC}a\x02`,
  BOLD_ON: `${ESC}E\x01`,
  BOLD_OFF: `${ESC}E\x00`,
  DOUBLE_HEIGHT: `${ESC}!\x10`,
  DOUBLE_WIDTH: `${ESC}!\x20`,
  DOUBLE_SIZE: `${ESC}!\x30`,
  NORMAL: `${ESC}!\x00`,
  CUT: `${GS}V\x01`,
  FEED: (n: number) => `${ESC}d${String.fromCharCode(n)}`,
};

export interface OrderItem {
  qty: number;
  name: string;
  price?: number;
  modifiers?: string[];
  specialInstructions?: string;
}

export interface OrderData {
  id: string;
  orderNumber: string;
  items: OrderItem[];
  total: number;
  subtotal?: number;
  tax?: number;
  discount?: number;
  paymentMethod?: string;
  note?: string;
  tableName?: string;
  customerName?: string;
  cashierName?: string;
  timestamp?: Date;
}

/**
 * Build customer receipt ESC/POS data
 */
export const buildCustomerReceipt = (order: OrderData): any[] => {
  const timestamp = (order.timestamp || new Date()).toLocaleString('en-ZA');
  
  return [
    { type: 'raw', format: 'plain', data: ESCPOS.RESET },
    { type: 'raw', format: 'plain', data: ESCPOS.CENTER },
    { type: 'raw', format: 'plain', data: ESCPOS.DOUBLE_SIZE },
    { type: 'raw', format: 'plain', data: 'MR TECH SOLUTIONS\n' },
    { type: 'raw', format: 'plain', data: ESCPOS.NORMAL },
    { type: 'raw', format: 'plain', data: 'POS SYSTEM\n' },
    { type: 'raw', format: 'plain', data: '\n' },
    { type: 'raw', format: 'plain', data: '\n' },
    { type: 'raw', format: 'plain', data: ESCPOS.FEED(1) },
    { type: 'raw', format: 'plain', data: ESCPOS.LEFT },
    { type: 'raw', format: 'plain', data: `Order #${order.orderNumber}\n` },
    { type: 'raw', format: 'plain', data: `Date: ${timestamp}\n` },
    ...(order.tableName ? [{ type: 'raw', format: 'plain', data: `Table: ${order.tableName}\n` }] : []),
    ...(order.customerName ? [{ type: 'raw', format: 'plain', data: `Customer: ${order.customerName}\n` }] : []),
    ...(order.cashierName ? [{ type: 'raw', format: 'plain', data: `Served by: ${order.cashierName}\n` }] : []),
    { type: 'raw', format: 'plain', data: '-'.repeat(32) + '\n' },
    ...order.items.flatMap(item => [
      { type: 'raw', format: 'plain', data: `${item.qty}x ${item.name}\n` },
      ...(item.modifiers && item.modifiers.length > 0 
        ? [{ type: 'raw', format: 'plain', data: `   ${item.modifiers.join(', ')}\n` }] 
        : []),
      ...(item.price 
        ? [{ type: 'raw', format: 'plain', data: ESCPOS.RIGHT + `R${(item.price * item.qty).toFixed(2)}\n` + ESCPOS.LEFT }] 
        : []),
    ]),
    { type: 'raw', format: 'plain', data: '-'.repeat(32) + '\n' },
    ...(order.subtotal ? [{ type: 'raw', format: 'plain', data: `Subtotal: R${order.subtotal.toFixed(2)}\n` }] : []),
    ...(order.tax ? [{ type: 'raw', format: 'plain', data: `VAT (incl): R${order.tax.toFixed(2)}\n` }] : []),
    ...(order.discount && order.discount > 0 ? [{ type: 'raw', format: 'plain', data: `Discount: -R${order.discount.toFixed(2)}\n` }] : []),
    { type: 'raw', format: 'plain', data: ESCPOS.BOLD_ON },
    { type: 'raw', format: 'plain', data: `TOTAL: R${order.total.toFixed(2)}\n` },
    { type: 'raw', format: 'plain', data: ESCPOS.BOLD_OFF },
    ...(order.paymentMethod ? [{ type: 'raw', format: 'plain', data: `Payment: ${order.paymentMethod.toUpperCase()}\n` }] : []),
    { type: 'raw', format: 'plain', data: ESCPOS.FEED(1) },
    { type: 'raw', format: 'plain', data: ESCPOS.CENTER },
    { type: 'raw', format: 'plain', data: 'Thank you for your business!\n' },
    { type: 'raw', format: 'plain', data: ESCPOS.FEED(3) },
    { type: 'raw', format: 'plain', data: ESCPOS.CUT },
  ];
};

/**
 * Build kitchen slip ESC/POS data
 */
export const buildKitchenSlip = (order: OrderData): any[] => {
  return [
    { type: 'raw', format: 'plain', data: ESCPOS.RESET },
    { type: 'raw', format: 'plain', data: ESCPOS.CENTER },
    { type: 'raw', format: 'plain', data: ESCPOS.DOUBLE_SIZE },
    { type: 'raw', format: 'plain', data: `ORDER #${order.orderNumber}\n` },
    { type: 'raw', format: 'plain', data: ESCPOS.NORMAL },
    { type: 'raw', format: 'plain', data: ESCPOS.FEED(1) },
    ...(order.tableName ? [
      { type: 'raw', format: 'plain', data: ESCPOS.BOLD_ON },
      { type: 'raw', format: 'plain', data: `TABLE: ${order.tableName}\n` },
      { type: 'raw', format: 'plain', data: ESCPOS.BOLD_OFF },
    ] : []),
    { type: 'raw', format: 'plain', data: ESCPOS.LEFT },
    { type: 'raw', format: 'plain', data: '-'.repeat(32) + '\n' },
    ...order.items.flatMap(item => [
      { type: 'raw', format: 'plain', data: ESCPOS.BOLD_ON },
      { type: 'raw', format: 'plain', data: `${item.qty}x ${item.name}\n` },
      { type: 'raw', format: 'plain', data: ESCPOS.BOLD_OFF },
      ...(item.modifiers && item.modifiers.length > 0 
        ? [{ type: 'raw', format: 'plain', data: `   -> ${item.modifiers.join(', ')}\n` }] 
        : []),
      ...(item.specialInstructions 
        ? [{ type: 'raw', format: 'plain', data: `   !! ${item.specialInstructions}\n` }] 
        : []),
    ]),
    { type: 'raw', format: 'plain', data: '-'.repeat(32) + '\n' },
    ...(order.note ? [
      { type: 'raw', format: 'plain', data: ESCPOS.BOLD_ON },
      { type: 'raw', format: 'plain', data: `Notes: ${order.note}\n` },
      { type: 'raw', format: 'plain', data: ESCPOS.BOLD_OFF },
    ] : []),
    { type: 'raw', format: 'plain', data: ESCPOS.FEED(3) },
    { type: 'raw', format: 'plain', data: ESCPOS.CUT },
  ];
};

export interface QZPrinterConfig {
  cashier: string | null;
  kitchen: string | null;
}

/**
 * Fetch QZ printer configuration from Supabase
 */
export const fetchQZPrinterConfig = async (): Promise<QZPrinterConfig> => {
  try {
    const { data, error } = await supabase
      .from('qz_printers')
      .select('label, printer_name');

    if (error) throw error;

    const config: QZPrinterConfig = { cashier: null, kitchen: null };
    data?.forEach(row => {
      if (row.label === 'cashier') config.cashier = row.printer_name;
      if (row.label === 'kitchen') config.kitchen = row.printer_name;
    });

    return config;
  } catch (err) {
    console.error('[QZ Tray] Error fetching config:', err);
    return { cashier: null, kitchen: null };
  }
};

/**
 * Save QZ printer configuration to Supabase
 */
export const saveQZPrinterConfig = async (
  label: 'cashier' | 'kitchen',
  printerName: string
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('qz_printers')
      .upsert(
        { label, printer_name: printerName, updated_at: new Date().toISOString() },
        { onConflict: 'label' }
      );

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('[QZ Tray] Error saving config:', err);
    return false;
  }
};

export interface QZPrintResult {
  success: boolean;
  message: string;
  cashierPrinted: boolean;
  kitchenPrinted: boolean;
}

/**
 * Auto print order to both cashier and kitchen printers via QZ Tray
 */
export const autoPrintOrder = async (order: OrderData): Promise<QZPrintResult> => {
  // Check QZ connection
  if (!await initQZTray()) {
    console.warn('[QZ Tray] Not connected, cannot print');
    return {
      success: false,
      message: 'QZ Tray not connected. Please install and run QZ Tray.',
      cashierPrinted: false,
      kitchenPrinted: false,
    };
  }

  // Fetch printer configuration
  const config = await fetchQZPrinterConfig();

  if (!config.cashier && !config.kitchen) {
    console.error('[QZ Tray] No printers configured');
    return {
      success: false,
      message: 'No printers configured. Go to Admin > Print Settings > QZ Tray.',
      cashierPrinted: false,
      kitchenPrinted: false,
    };
  }

  let cashierPrinted = false;
  let kitchenPrinted = false;
  const errors: string[] = [];

  // Build print data
  const cashierData = buildCustomerReceipt(order);
  const kitchenData = buildKitchenSlip(order);

  // Create print promises
  const printPromises: Promise<void>[] = [];

  if (config.cashier) {
    const cashierConfig = createPrinterConfig(config.cashier);
    if (cashierConfig) {
      printPromises.push(
        window.qz.print(cashierConfig, cashierData)
          .then(() => {
            cashierPrinted = true;
            console.log('[QZ Tray] Cashier receipt printed');
          })
          .catch((err: any) => {
            console.error('[QZ Tray] Cashier print error:', err);
            errors.push(`Cashier: ${err.message || 'Failed'}`);
          })
      );
    }
  }

  if (config.kitchen) {
    const kitchenConfig = createPrinterConfig(config.kitchen);
    if (kitchenConfig) {
      printPromises.push(
        window.qz.print(kitchenConfig, kitchenData)
          .then(() => {
            kitchenPrinted = true;
            console.log('[QZ Tray] Kitchen slip printed');
          })
          .catch((err: any) => {
            console.error('[QZ Tray] Kitchen print error:', err);
            errors.push(`Kitchen: ${err.message || 'Failed'}`);
          })
      );
    }
  }

  // Execute both prints simultaneously
  try {
    await Promise.all(printPromises);
  } catch (err) {
    console.error('[QZ Tray] Print error:', err);
  }

  // Log results
  if (cashierPrinted || kitchenPrinted) {
    try {
      await supabase.from('printer_logs').insert({
        order_id: order.id,
        printer_name: 'QZ Tray',
        print_type: 'dual',
        status: cashierPrinted && kitchenPrinted ? 'success' : 'partial',
        error_message: errors.length > 0 ? errors.join('; ') : null,
      });
    } catch (logErr) {
      console.warn('[QZ Tray] Failed to log print result:', logErr);
    }
  }

  // Build result
  let message = '';
  if (cashierPrinted && kitchenPrinted) {
    message = 'Receipt sent to Cashier and Kitchen Printers';
  } else if (cashierPrinted) {
    message = 'Cashier receipt printed (kitchen printer unavailable)';
  } else if (kitchenPrinted) {
    message = 'Kitchen slip printed (cashier printer unavailable)';
  } else {
    message = errors.length > 0 ? errors.join('; ') : 'Print failed';
  }

  return {
    success: cashierPrinted || kitchenPrinted,
    message,
    cashierPrinted,
    kitchenPrinted,
  };
};

/**
 * Test print to a specific printer
 */
export const testPrint = async (printerName: string): Promise<boolean> => {
  if (!await initQZTray()) {
    return false;
  }

  try {
    const config = createPrinterConfig(printerName);
    if (!config) return false;

    const testData = [
      { type: 'raw', format: 'plain', data: ESCPOS.RESET },
      { type: 'raw', format: 'plain', data: ESCPOS.CENTER },
      { type: 'raw', format: 'plain', data: ESCPOS.DOUBLE_SIZE },
      { type: 'raw', format: 'plain', data: 'TEST PRINT\n' },
      { type: 'raw', format: 'plain', data: ESCPOS.NORMAL },
      { type: 'raw', format: 'plain', data: `Printer: ${printerName}\n` },
      { type: 'raw', format: 'plain', data: `Time: ${new Date().toLocaleString()}\n` },
      { type: 'raw', format: 'plain', data: ESCPOS.FEED(1) },
      { type: 'raw', format: 'plain', data: 'If you see this, QZ Tray\n' },
      { type: 'raw', format: 'plain', data: 'is working correctly!\n' },
      { type: 'raw', format: 'plain', data: ESCPOS.FEED(3) },
      { type: 'raw', format: 'plain', data: ESCPOS.CUT },
    ];

    await window.qz.print(config, testData);
    return true;
  } catch (err) {
    console.error('[QZ Tray] Test print error:', err);
    return false;
  }
};
