/**
 * Print Service - Multi-destination order routing based on configured printer settings
 * Supports Kitchen/Bar printer routing and Receipt printing
 */

import { supabase } from '@/integrations/supabase/client';

export interface PrintItem {
  productName: string;
  qty: number;
  weightAmount?: number;
  weightUnit?: string;
  modifiers?: string[];
  specialInstructions?: string;
  categoryName?: string;
  kitchenStation?: string;
  price?: number;
  lineTotal?: number;
}

export interface PrintOrderData {
  orderNumber: string;
  orderType: 'dine_in' | 'takeout' | 'delivery' | 'collection';
  tableName?: string;
  customerName?: string;
  items: PrintItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  paymentMethod: string;
  cashierName?: string;
  timestamp: Date;
}

interface PrinterSetting {
  id: string;
  name: string;
  ip_address: string;
  printer_type: 'kitchen' | 'receipt' | 'bar';
  is_active: boolean;
  print_order?: number; // Lower numbers print first
}

interface RoutingRule {
  category_name: string;
  printer_id: string;
}

interface ReceiptBranding {
  logo_url: string | null;
  business_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  phone: string | null;
  footer_text: string | null;
}

// Paper size configuration (80mm thermal paper standard)
export interface PaperSize {
  name: string;
  widthMm: number;
  printableWidthMm: number;
  heightMm: number;
}

export const PAPER_SIZES: Record<string, PaperSize> = {
  '80mm': {
    name: '80mm Standard',
    widthMm: 80,
    printableWidthMm: 72.1, // Actual printable width
    heightMm: 210,
  },
  '58mm': {
    name: '58mm Compact',
    widthMm: 58,
    printableWidthMm: 48,
    heightMm: 210,
  },
};

export const DEFAULT_PAPER_SIZE = PAPER_SIZES['80mm'];

// Print order constants (lower = prints first)
export const PRINT_ORDER = {
  KITCHEN: 1,  // Kitchen prints first
  BAR: 2,      // Bar prints second
  RECEIPT: 180, // Receipt prints last (as per user request)
} as const;

// Cache for print settings
let cachedPrinters: PrinterSetting[] | null = null;
let cachedRoutes: RoutingRule[] | null = null;
let cachedBranding: ReceiptBranding | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60000; // 1 minute cache

// Fallback categories for kitchen routing when no rules configured
const DEFAULT_KITCHEN_CATEGORIES = [
  'Food', 'Hot Drinks', 'Coffee', 'Tea', 'Alcohol', 'Beverages', 'Bar',
  'Mains', 'Starters', 'Grills', 'Platters', 'Burgers', 'Sides', 'Dessert'
];

// Default logo path for receipts and kitchen tickets
// Use window.location.origin to ensure the path works in all contexts (preview, print, etc.)
const getDefaultLogoUrl = () => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/casbah-logo-print.jpg`;
  }
  return '/casbah-logo-print.jpg';
};

const DEFAULT_LOGO_URL = getDefaultLogoUrl();

// ESC/POS Commands
const ESC = '\x1B';
const GS = '\x1D';
const COMMANDS = {
  INIT: `${ESC}@`,
  CENTER: `${ESC}a\x01`,
  LEFT: `${ESC}a\x00`,
  RIGHT: `${ESC}a\x02`,
  BOLD_ON: `${ESC}E\x01`,
  BOLD_OFF: `${ESC}E\x00`,
  DOUBLE_HEIGHT: `${ESC}!\x10`,
  DOUBLE_WIDTH: `${ESC}!\x20`,
  DOUBLE_SIZE: `${ESC}!\x30`,
  NORMAL: `${ESC}!\x00`,
  CUT: `${GS}V\x00`,
  PARTIAL_CUT: `${GS}V\x01`,
  FEED_LINES: (n: number) => `${ESC}d${String.fromCharCode(n)}`,
  PRINT_LOGO: '\x1C\x70\x01\x00',
};

/**
 * Fetch print settings from database with caching
 */
export const fetchPrintSettings = async (): Promise<{
  printers: PrinterSetting[];
  routes: RoutingRule[];
  branding: ReceiptBranding | null;
}> => {
  const now = Date.now();
  
  if (cachedPrinters && cachedRoutes && now - lastFetchTime < CACHE_DURATION) {
    return { printers: cachedPrinters, routes: cachedRoutes, branding: cachedBranding };
  }

  try {
    const [printersRes, routesRes, brandingRes] = await Promise.all([
      supabase.from('printer_settings').select('*').eq('is_active', true),
      supabase.from('print_routing_rules').select('category_name, printer_id'),
      supabase.from('receipt_branding').select('*').limit(1).single()
    ]);

    cachedPrinters = (printersRes.data || []).map(p => ({
      ...p,
      printer_type: p.printer_type as 'kitchen' | 'receipt' | 'bar'
    }));
    cachedRoutes = routesRes.data || [];
    cachedBranding = brandingRes.data || null;
    lastFetchTime = now;

    return { printers: cachedPrinters, routes: cachedRoutes, branding: cachedBranding };
  } catch (error) {
    console.error('Failed to fetch print settings:', error);
    return { printers: [], routes: [], branding: null };
  }
};

/**
 * Clear the print settings cache (call after updating settings)
 */
export const clearPrintSettingsCache = () => {
  cachedPrinters = null;
  cachedRoutes = null;
  cachedBranding = null;
  lastFetchTime = 0;
};

/**
 * Filter items for kitchen/bar printing based on configured routes
 */
export const filterKitchenItems = (
  items: PrintItem[],
  routes: RoutingRule[],
  printers: PrinterSetting[]
): PrintItem[] => {
  const kitchenPrinterIds = printers
    .filter(p => p.printer_type === 'kitchen' || p.printer_type === 'bar')
    .map(p => p.id);

  const kitchenCategories = routes
    .filter(r => kitchenPrinterIds.includes(r.printer_id))
    .map(r => r.category_name.toLowerCase());

  // If no routes configured, use default categories
  const categoriesToCheck = kitchenCategories.length > 0 
    ? kitchenCategories 
    : DEFAULT_KITCHEN_CATEGORIES.map(c => c.toLowerCase());

  return items.filter(item => {
    const category = (item.categoryName || '').toLowerCase();
    return categoriesToCheck.some(cat => category.includes(cat) || cat.includes(category));
  });
};

/**
 * Generate kitchen order ticket content
 */
export const generateKitchenTicket = (order: PrintOrderData, kitchenItems?: PrintItem[]): string => {
  const items = kitchenItems || order.items;
  
  if (items.length === 0) return '';

  const orderTypeDisplay = order.orderType.replace('_', ' ').toUpperCase();
  const timestamp = order.timestamp.toLocaleTimeString('en-ZA', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return `
    <div style="font-family: 'Courier New', monospace; width: 280px; padding: 10px; background: white; color: black;">
      <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px;">
        <img src="${DEFAULT_LOGO_URL}" alt="Casbah Logo" style="max-width: 180px; max-height: 70px; margin-bottom: 8px; filter: grayscale(100%) contrast(1.2);" onerror="this.style.display='none'" />
        <div style="font-size: 20px; font-weight: bold;">KITCHEN ORDER</div>
        <div style="font-size: 28px; font-weight: bold; margin: 5px 0;">
          #${order.orderNumber.split('-').pop()?.toUpperCase()}
        </div>
        <div style="font-size: 16px;">${orderTypeDisplay}</div>
        ${order.tableName ? `<div style="font-size: 18px; font-weight: bold;">TABLE: ${order.tableName}</div>` : ''}
        ${order.customerName ? `<div style="font-size: 14px;">Customer: ${order.customerName}</div>` : ''}
        <div style="font-size: 12px; color: #666;">${timestamp}</div>
      </div>
      
      <div style="margin-bottom: 10px;">
        ${items.map(item => `
          <div style="margin: 10px 0; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: bold;">
              <span>${item.qty}x</span>
              <span style="flex: 1; margin-left: 10px;">${item.productName}</span>
            </div>
            ${item.weightAmount ? `<div style="font-size: 14px; color: #666; margin-left: 30px;">(${item.weightAmount}${item.weightUnit})</div>` : ''}
            ${item.modifiers && item.modifiers.length > 0 ? `
              <div style="font-size: 14px; color: #333; margin-left: 30px; font-style: italic;">
                → ${item.modifiers.join(', ')}
              </div>
            ` : ''}
            ${item.specialInstructions ? `
              <div style="font-size: 14px; color: #c00; margin-left: 30px; font-weight: bold;">
                ⚠ ${item.specialInstructions}
              </div>
            ` : ''}
            <div style="font-size: 12px; color: #888; margin-left: 30px;">
              Station: ${item.kitchenStation || 'General'}
            </div>
          </div>
        `).join('')}
      </div>
      
      <div style="border-top: 2px dashed #000; padding-top: 10px; text-align: center;">
        <div style="font-size: 12px; color: #666;">
          Items: ${items.length} | Total Qty: ${items.reduce((sum, i) => sum + i.qty, 0)}
        </div>
      </div>
    </div>
  `;
};

/**
 * Generate customer receipt content with branding
 */
export const generateReceipt = (
  order: PrintOrderData, 
  branding?: ReceiptBranding | null
): string => {
  const timestamp = order.timestamp.toLocaleString('en-ZA');
  const orderTypeDisplay = order.orderType.replace('_', ' ').toUpperCase();

  const businessName = branding?.business_name || 'CASBAH';
  const addressLine1 = branding?.address_line1 || '194 Marine Drive';
  const addressLine2 = branding?.address_line2 || '';
  const phone = branding?.phone || '065 683 5702';
  const footerText = branding?.footer_text || 'Thank you for visiting CASBAH!';

  // Use branding logo if set, otherwise use default logo
  const logoUrl = branding?.logo_url || DEFAULT_LOGO_URL;

  return `
    <div style="font-family: 'Courier New', monospace; width: 280px; padding: 10px; background: white; color: black;">
      <div style="text-align: center; margin-bottom: 10px;">
        <img src="${logoUrl}" alt="${businessName} Logo" style="max-width: 200px; max-height: 70px; margin-bottom: 5px; filter: grayscale(100%) contrast(1.2);" onerror="this.style.display='none'" />
        <div style="font-size: 11px;">GRILL & COFFEE</div>
      </div>
      
      <div style="text-align: center; margin-bottom: 10px;">
        <div style="font-size: 11px;">${addressLine1}</div>
        ${addressLine2 ? `<div style="font-size: 11px;">${addressLine2}</div>` : ''}
        <div style="font-size: 11px;">Tel: ${phone}</div>
        <div style="font-size: 11px; margin-top: 5px;">VAT No: [VAT NUMBER]</div>
      </div>
      
      <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 8px 0; margin: 8px 0; text-align: center;">
        <div style="font-size: 14px; font-weight: bold;">Receipt #${order.orderNumber.split('-').pop()?.toUpperCase()}</div>
        <div style="font-size: 11px;">${orderTypeDisplay}</div>
        ${order.tableName ? `<div style="font-size: 11px;">Table: ${order.tableName}</div>` : ''}
        ${order.customerName ? `<div style="font-size: 11px;">Customer: ${order.customerName}</div>` : ''}
        <div style="font-size: 10px; color: #666;">${timestamp}</div>
        ${order.cashierName ? `<div style="font-size: 10px; color: #666;">Served by: ${order.cashierName}</div>` : ''}
      </div>
      
      <div style="margin-bottom: 10px;">
        ${order.items.map(item => `
          <div style="display: flex; justify-content: space-between; margin: 4px 0; font-size: 12px;">
            <div style="flex: 1;">
              <span>${item.productName}</span>
              ${item.weightAmount ? `<span style="color: #666;"> (${item.weightAmount}${item.weightUnit})</span>` : ''}
              <span style="color: #666;"> x${item.qty}</span>
              ${item.modifiers && item.modifiers.length > 0 ? `
                <div style="font-size: 10px; color: #666; margin-left: 10px;">
                  ${item.modifiers.join(', ')}
                </div>
              ` : ''}
            </div>
            <div style="text-align: right; white-space: nowrap;">
              R${((item.lineTotal || (item.price || 0) * item.qty)).toFixed(2)}
            </div>
          </div>
        `).join('')}
      </div>
      
      <div style="border-top: 1px dashed #000; padding-top: 8px; margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin: 3px 0;">
          <span>Subtotal:</span>
          <span>R${order.subtotal.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin: 3px 0;">
          <span>VAT (incl):</span>
          <span>R${order.taxAmount.toFixed(2)}</span>
        </div>
        ${order.discountAmount > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin: 3px 0; color: #090;">
            <span>Discount:</span>
            <span>-R${order.discountAmount.toFixed(2)}</span>
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; margin: 8px 0; border-top: 1px solid #000; padding-top: 8px;">
          <span>TOTAL:</span>
          <span>R${order.total.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin: 3px 0;">
          <span>Payment:</span>
          <span>${order.paymentMethod.toUpperCase()}</span>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 15px; padding-top: 10px; border-top: 1px dashed #000;">
        <div style="font-size: 12px; font-weight: bold;">${footerText}</div>
        <div style="font-size: 10px; color: #666; margin-top: 5px;">VAT included where applicable</div>
      </div>
    </div>
  `;
};

/**
 * Print to browser automatically using iframe (silent print)
 * Paper size: 80mm × 210mm (72.1mm printable width)
 */
export const printToBrowser = (
  content: string, 
  copies: number = 1,
  paperSize: PaperSize = DEFAULT_PAPER_SIZE,
  title: string = 'Print'
): Promise<void> => {
  return new Promise((resolve) => {
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = 'none';
    printFrame.style.opacity = '0';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentDocument || printFrame.contentWindow?.document;
    if (!frameDoc) {
      document.body.removeChild(printFrame);
      resolve();
      return;
    }

    // Build content for all copies
    const copiesContent = Array(copies).fill(content).map((c, i) => 
      `<div class="page" ${i > 0 ? 'style="page-break-before: always;"' : ''}>${c}</div>`
    ).join('');

    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { 
            size: ${paperSize.widthMm}mm ${paperSize.heightMm}mm;
            margin: 0; 
          }
          @media print {
            body { margin: 0; padding: 0; }
            .page { page-break-after: always; }
            .page:last-child { page-break-after: auto; }
          }
          body {
            width: ${paperSize.printableWidthMm}mm;
            max-width: ${paperSize.printableWidthMm}mm;
            margin: 0 auto;
          }
        </style>
      </head>
      <body>${copiesContent}</body>
      </html>
    `);
    frameDoc.close();

    // Wait for content to load, then print
    printFrame.onload = () => {
      setTimeout(() => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
        } catch (e) {
          console.error('[Print] Error printing:', e);
        }
        
        // Clean up after print dialog closes
        setTimeout(() => {
          if (printFrame.parentNode) {
            document.body.removeChild(printFrame);
          }
          resolve();
        }, 1000);
      }, 100);
    };

    // Fallback if onload doesn't fire
    setTimeout(() => {
      try {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      } catch (e) {
        console.error('[Print] Fallback print error:', e);
      }
      setTimeout(() => {
        if (printFrame.parentNode) {
          document.body.removeChild(printFrame);
        }
        resolve();
      }, 1000);
    }, 500);
  });
};

/**
 * Send print job to network printer via raw TCP (requires print server/proxy)
 */
export const sendToNetworkPrinter = async (
  printerIp: string,
  data: string,
  port: number = 9100
): Promise<boolean> => {
  // Note: Direct TCP printing from browser is not possible due to security restrictions
  // This would need to be routed through an edge function or local print server
  console.log(`[Print] Would send to ${printerIp}:${port}`, data.length, 'bytes');
  
  // For now, fall back to browser printing
  return false;
};

/**
 * Main print function - handles automatic sequential printing
 * Prints kitchen first (order 1), then receipt (order 180) based on configured settings
 * Paper size: 80mm (72.1mm printable) x 210mm default
 */
export const printOrder = async (
  order: PrintOrderData, 
  options: {
    printKitchenTicket?: boolean;
    printReceipt?: boolean;
    receiptCopies?: number;
    paperSize?: PaperSize;
  } = {}
): Promise<void> => {
  const {
    printKitchenTicket = true,
    printReceipt = true,
    receiptCopies = 2,
    paperSize = DEFAULT_PAPER_SIZE
  } = options;

  // Fetch configured settings
  const { printers, routes, branding } = await fetchPrintSettings();

  // Get kitchen items based on routing rules
  const kitchenItems = filterKitchenItems(order.items, routes, printers);
  const hasKitchenItems = kitchenItems.length > 0;

  // Check if we have configured printers - sorted by print order
  const kitchenPrinter = printers.find(p => p.printer_type === 'kitchen');
  const barPrinter = printers.find(p => p.printer_type === 'bar');
  const receiptPrinter = printers.find(p => p.printer_type === 'receipt');

  console.log('[Print] Starting sequential print (kitchen first, then receipt):', {
    kitchenItems: kitchenItems.length,
    hasKitchenPrinter: !!kitchenPrinter,
    hasReceiptPrinter: !!receiptPrinter,
    paperSize: `${paperSize.widthMm}mm x ${paperSize.heightMm}mm (printable: ${paperSize.printableWidthMm}mm)`
  });

  // STEP 1: Print kitchen ticket FIRST (print order 1)
  if (printKitchenTicket && hasKitchenItems) {
    console.log('[Print] Step 1: Printing kitchen ticket...');
    const kitchenContent = generateKitchenTicket(order, kitchenItems);
    
    if (kitchenPrinter) {
      const sent = await sendToNetworkPrinter(kitchenPrinter.ip_address, kitchenContent);
      if (!sent) {
        await printToBrowser(kitchenContent, 1, paperSize, 'Kitchen Order');
      }
    } else {
      await printToBrowser(kitchenContent, 1, paperSize, 'Kitchen Order');
    }
    
    // Wait for kitchen print dialog to close before showing receipt
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('[Print] Kitchen ticket complete, proceeding to receipt...');
  }

  // STEP 2: Print receipt SECOND (print order 180)
  if (printReceipt) {
    console.log('[Print] Step 2: Printing receipt (order 180)...');
    const receiptContent = generateReceipt(order, branding);
    
    if (receiptPrinter) {
      const sent = await sendToNetworkPrinter(receiptPrinter.ip_address, receiptContent);
      if (!sent) {
        await printToBrowser(receiptContent, receiptCopies, paperSize, 'Customer Receipt');
      }
    } else {
      await printToBrowser(receiptContent, receiptCopies, paperSize, 'Customer Receipt');
    }
  }
  
  console.log('[Print] Sequential printing complete');
};

/**
 * Quick function to print both kitchen and receipt at once
 */
export const printDualOrder = async (order: PrintOrderData): Promise<void> => {
  return printOrder(order, {
    printKitchenTicket: true,
    printReceipt: true,
    receiptCopies: 2
  });
};

/**
 * Generate ESC/POS raw commands for thermal printer integration
 */
export const generateEscPosReceipt = (
  order: PrintOrderData,
  branding?: ReceiptBranding | null
): string => {
  let data = '';
  
  const businessName = branding?.business_name || 'CASBAH';
  const addressLine1 = branding?.address_line1 || '194 Marine Drive';
  const phone = branding?.phone || '065 683 5702';
  const footerText = branding?.footer_text || 'Thank you for visiting CASBAH!';
  
  data += COMMANDS.INIT;
  data += COMMANDS.CENTER;
  data += COMMANDS.PRINT_LOGO;
  data += COMMANDS.FEED_LINES(1);
  
  data += COMMANDS.CENTER;
  data += COMMANDS.DOUBLE_SIZE;
  data += businessName + '\n';
  data += COMMANDS.NORMAL;
  data += 'GRILL & COFFEE\n';
  data += addressLine1 + '\n';
  data += `Tel: ${phone}\n`;
  data += COMMANDS.FEED_LINES(1);
  
  data += COMMANDS.LEFT;
  data += `Receipt: ${order.orderNumber}\n`;
  data += `Date: ${order.timestamp.toLocaleString()}\n`;
  data += COMMANDS.FEED_LINES(1);
  
  data += '--------------------------------\n';
  order.items.forEach(item => {
    const itemTotal = (item.lineTotal || (item.price || 0) * item.qty).toFixed(2);
    data += `${item.qty}x ${item.productName}\n`;
    if (item.modifiers && item.modifiers.length > 0) {
      data += `   ${item.modifiers.join(', ')}\n`;
    }
    data += COMMANDS.RIGHT;
    data += `R${itemTotal}\n`;
    data += COMMANDS.LEFT;
  });
  data += '--------------------------------\n';
  
  data += COMMANDS.BOLD_ON;
  data += `TOTAL: R${order.total.toFixed(2)}\n`;
  data += COMMANDS.BOLD_OFF;
  data += `Payment: ${order.paymentMethod}\n`;
  
  data += COMMANDS.FEED_LINES(2);
  data += COMMANDS.CENTER;
  data += footerText + '\n';
  data += COMMANDS.FEED_LINES(3);
  data += COMMANDS.PARTIAL_CUT;
  
  return data;
};