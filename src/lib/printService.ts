/**
 * Print Service - Multi-destination order routing based on product category
 * Supports Kitchen/Bar printer routing and Receipt printing
 */

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

// Categories that route to Kitchen/Bar printer
const KITCHEN_BAR_CATEGORIES = [
  'Food',
  'Hot Drinks',
  'Coffee',
  'Tea',
  'Alcohol',
  'Beverages',
  'Bar',
  'Mains',
  'Starters',
  'Grills',
  'Platters',
  'Burgers',
  'Sides'
];

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
  // Logo placeholder - FS p n m (print stored logo)
  PRINT_LOGO: '\x1C\x70\x01\x00', // FS p 01 00 - prints stored logo #1
};

/**
 * Filter items for kitchen/bar printing
 */
export const filterKitchenItems = (items: PrintItem[]): PrintItem[] => {
  return items.filter(item => {
    const category = item.categoryName || '';
    return KITCHEN_BAR_CATEGORIES.some(cat => 
      category.toLowerCase().includes(cat.toLowerCase())
    );
  });
};

/**
 * Generate kitchen order ticket content (HTML for browser printing)
 */
export const generateKitchenTicket = (order: PrintOrderData): string => {
  const kitchenItems = filterKitchenItems(order.items);
  
  if (kitchenItems.length === 0) return '';

  const orderTypeDisplay = order.orderType.replace('_', ' ').toUpperCase();
  const timestamp = order.timestamp.toLocaleTimeString('en-ZA', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return `
    <div style="font-family: 'Courier New', monospace; width: 280px; padding: 10px; background: white; color: black;">
      <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px;">
        <div style="font-size: 24px; font-weight: bold;">KITCHEN ORDER</div>
        <div style="font-size: 28px; font-weight: bold; margin: 5px 0;">
          #${order.orderNumber.split('-').pop()?.toUpperCase()}
        </div>
        <div style="font-size: 16px;">${orderTypeDisplay}</div>
        ${order.tableName ? `<div style="font-size: 18px; font-weight: bold;">TABLE: ${order.tableName}</div>` : ''}
        ${order.customerName ? `<div style="font-size: 14px;">Customer: ${order.customerName}</div>` : ''}
        <div style="font-size: 12px; color: #666;">${timestamp}</div>
      </div>
      
      <div style="margin-bottom: 10px;">
        ${kitchenItems.map(item => `
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
          Items: ${kitchenItems.length} | Total Qty: ${kitchenItems.reduce((sum, i) => sum + i.qty, 0)}
        </div>
      </div>
    </div>
  `;
};

/**
 * Generate customer receipt content (HTML for browser printing)
 */
export const generateReceipt = (order: PrintOrderData, includeLogo: boolean = true): string => {
  const timestamp = order.timestamp.toLocaleString('en-ZA');
  const orderTypeDisplay = order.orderType.replace('_', ' ').toUpperCase();

  return `
    <div style="font-family: 'Courier New', monospace; width: 280px; padding: 10px; background: white; color: black;">
      ${includeLogo ? `
        <!-- Logo placeholder - Will be replaced with stored logo on thermal printer -->
        <div style="text-align: center; margin-bottom: 10px;">
          <div style="font-size: 28px; font-weight: bold; letter-spacing: 2px;">CASBAH</div>
          <div style="font-size: 11px;">GRILL & COFFEE</div>
        </div>
      ` : ''}
      
      <div style="text-align: center; margin-bottom: 10px;">
        <div style="font-size: 11px;">194 Marine Drive</div>
        <div style="font-size: 11px;">Tel: 065 683 5702</div>
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
        <div style="font-size: 12px; font-weight: bold;">Thank you for visiting CASBAH!</div>
        <div style="font-size: 10px; color: #666; margin-top: 5px;">VAT included where applicable</div>
        <div style="font-size: 10px; color: #666;">www.casbah.co.za</div>
      </div>
    </div>
  `;
};

/**
 * Print to browser (creates hidden iframe and triggers print)
 */
export const printToBrowser = (content: string, copies: number = 1): void => {
  for (let i = 0; i < copies; i++) {
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'absolute';
    printFrame.style.top = '-10000px';
    printFrame.style.left = '-10000px';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentDocument || printFrame.contentWindow?.document;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Print</title>
          <style>
            @media print {
              body { margin: 0; padding: 0; }
              @page { margin: 0; size: 80mm auto; }
            }
          </style>
        </head>
        <body>${content}</body>
        </html>
      `);
      frameDoc.close();

      setTimeout(() => {
        printFrame.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(printFrame);
        }, 1000);
      }, 250);
    }
  }
};

/**
 * Main print function - handles multi-destination routing
 * @param order - Order data to print
 * @param options - Print options
 */
export const printOrder = (
  order: PrintOrderData, 
  options: {
    printKitchenTicket?: boolean;
    printReceipt?: boolean;
    receiptCopies?: number;
  } = {}
): void => {
  const {
    printKitchenTicket = true,
    printReceipt = true,
    receiptCopies = 2 // Default: customer copy + cashier/till copy
  } = options;

  // Print kitchen ticket if there are kitchen items
  if (printKitchenTicket) {
    const kitchenContent = generateKitchenTicket(order);
    if (kitchenContent) {
      printToBrowser(kitchenContent, 1);
    }
  }

  // Print receipt (all items)
  if (printReceipt) {
    const receiptContent = generateReceipt(order, true);
    printToBrowser(receiptContent, receiptCopies);
  }
};

/**
 * Generate ESC/POS raw commands for thermal printer integration
 * This can be used when integrating with native printer drivers
 */
export const generateEscPosReceipt = (order: PrintOrderData): string => {
  let data = '';
  
  // Initialize printer
  data += COMMANDS.INIT;
  
  // Print stored logo (placeholder for FS p 01 00)
  data += COMMANDS.CENTER;
  data += COMMANDS.PRINT_LOGO;
  data += COMMANDS.FEED_LINES(1);
  
  // Header
  data += COMMANDS.CENTER;
  data += COMMANDS.DOUBLE_SIZE;
  data += 'CASBAH\n';
  data += COMMANDS.NORMAL;
  data += 'GRILL & COFFEE\n';
  data += '194 Marine Drive\n';
  data += 'Tel: 065 683 5702\n';
  data += COMMANDS.FEED_LINES(1);
  
  // Order details
  data += COMMANDS.LEFT;
  data += `Receipt: ${order.orderNumber}\n`;
  data += `Date: ${order.timestamp.toLocaleString()}\n`;
  data += COMMANDS.FEED_LINES(1);
  
  // Items
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
  
  // Totals
  data += COMMANDS.BOLD_ON;
  data += `TOTAL: R${order.total.toFixed(2)}\n`;
  data += COMMANDS.BOLD_OFF;
  data += `Payment: ${order.paymentMethod}\n`;
  
  // Footer
  data += COMMANDS.FEED_LINES(2);
  data += COMMANDS.CENTER;
  data += 'Thank you for visiting CASBAH!\n';
  data += COMMANDS.FEED_LINES(3);
  data += COMMANDS.PARTIAL_CUT;
  
  return data;
};
