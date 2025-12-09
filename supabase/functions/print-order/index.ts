import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ESC/POS Commands for GTP-180 compatible printers
const ESC = '\x1B';
const GS = '\x1D';
const ESCPOS = {
  INIT: ESC + '@',
  CUT: GS + 'V' + '\x41' + '\x00',
  BOLD_ON: ESC + 'E' + '\x01',
  BOLD_OFF: ESC + 'E' + '\x00',
  ALIGN_CENTER: ESC + 'a' + '\x01',
  ALIGN_LEFT: ESC + 'a' + '\x00',
  ALIGN_RIGHT: ESC + 'a' + '\x02',
  DOUBLE_HEIGHT: ESC + '!' + '\x10',
  DOUBLE_WIDTH: ESC + '!' + '\x20',
  DOUBLE_SIZE: ESC + '!' + '\x30',
  NORMAL_SIZE: ESC + '!' + '\x00',
  LINE_FEED: '\n',
  UNDERLINE_ON: ESC + '-' + '\x01',
  UNDERLINE_OFF: ESC + '-' + '\x00',
};

interface PrinterConfig {
  ip: string;
  port: number;
  name: string;
  type: string;
}

interface OrderItem {
  product_name: string;
  qty: number;
  price_at_order: number;
  line_total: number;
  special_instructions?: string;
  modifiers?: { modifier_name: string; price_adjustment: number }[];
}

interface OrderData {
  order_number: string;
  order_type: string;
  table_number?: string;
  customer_name?: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  payment_method: string;
  cashier_name?: string;
  created_at: string;
}

// Generate ESC/POS receipt for customer
function generateCustomerReceipt(order: OrderData, branding: any): string {
  let receipt = ESCPOS.INIT;
  
  // Header
  receipt += ESCPOS.ALIGN_CENTER;
  receipt += ESCPOS.BOLD_ON;
  receipt += ESCPOS.DOUBLE_SIZE;
  receipt += (branding?.business_name || 'CASBAH') + ESCPOS.LINE_FEED;
  receipt += ESCPOS.NORMAL_SIZE;
  receipt += ESCPOS.BOLD_OFF;
  receipt += 'GRILL & COFFEE' + ESCPOS.LINE_FEED;
  receipt += ESCPOS.LINE_FEED;
  
  // Address
  if (branding?.address_line1) {
    receipt += branding.address_line1 + ESCPOS.LINE_FEED;
  }
  if (branding?.phone) {
    receipt += 'Tel: ' + branding.phone + ESCPOS.LINE_FEED;
  }
  receipt += ESCPOS.LINE_FEED;
  
  // Order info
  receipt += '--------------------------------' + ESCPOS.LINE_FEED;
  receipt += ESCPOS.BOLD_ON;
  receipt += 'Receipt #' + order.order_number.slice(-8) + ESCPOS.LINE_FEED;
  receipt += ESCPOS.BOLD_OFF;
  receipt += order.order_type.toUpperCase().replace('_', ' ') + ESCPOS.LINE_FEED;
  if (order.table_number) {
    receipt += 'Table: ' + order.table_number + ESCPOS.LINE_FEED;
  }
  if (order.customer_name) {
    receipt += 'Customer: ' + order.customer_name + ESCPOS.LINE_FEED;
  }
  receipt += formatDateTime(order.created_at) + ESCPOS.LINE_FEED;
  if (order.cashier_name) {
    receipt += 'Served by: ' + order.cashier_name + ESCPOS.LINE_FEED;
  }
  receipt += '--------------------------------' + ESCPOS.LINE_FEED;
  receipt += ESCPOS.LINE_FEED;
  
  // Items
  receipt += ESCPOS.ALIGN_LEFT;
  for (const item of order.items) {
    receipt += item.product_name;
    if (item.qty > 1) {
      receipt += ' x' + item.qty;
    }
    receipt += ESCPOS.LINE_FEED;
    
    // Modifiers
    if (item.modifiers && item.modifiers.length > 0) {
      for (const mod of item.modifiers) {
        receipt += '  + ' + mod.modifier_name;
        if (mod.price_adjustment > 0) {
          receipt += ' (+R' + mod.price_adjustment.toFixed(2) + ')';
        }
        receipt += ESCPOS.LINE_FEED;
      }
    }
    
    // Price aligned right
    const priceStr = 'R' + item.line_total.toFixed(2);
    receipt += '                        ' + priceStr + ESCPOS.LINE_FEED;
  }
  
  receipt += ESCPOS.LINE_FEED;
  receipt += '--------------------------------' + ESCPOS.LINE_FEED;
  
  // Totals
  receipt += 'Subtotal:          R' + order.subtotal.toFixed(2) + ESCPOS.LINE_FEED;
  receipt += 'VAT (incl):        R' + order.tax.toFixed(2) + ESCPOS.LINE_FEED;
  receipt += '--------------------------------' + ESCPOS.LINE_FEED;
  receipt += ESCPOS.BOLD_ON;
  receipt += ESCPOS.DOUBLE_HEIGHT;
  receipt += 'TOTAL:             R' + order.total.toFixed(2) + ESCPOS.LINE_FEED;
  receipt += ESCPOS.NORMAL_SIZE;
  receipt += ESCPOS.BOLD_OFF;
  receipt += 'Payment: ' + order.payment_method.toUpperCase() + ESCPOS.LINE_FEED;
  receipt += '--------------------------------' + ESCPOS.LINE_FEED;
  
  // Footer
  receipt += ESCPOS.LINE_FEED;
  receipt += ESCPOS.ALIGN_CENTER;
  receipt += ESCPOS.BOLD_ON;
  receipt += (branding?.footer_text || 'Thank you for visiting CASBAH!') + ESCPOS.LINE_FEED;
  receipt += ESCPOS.BOLD_OFF;
  receipt += 'VAT included where applicable' + ESCPOS.LINE_FEED;
  receipt += ESCPOS.LINE_FEED;
  receipt += ESCPOS.LINE_FEED;
  receipt += ESCPOS.LINE_FEED;
  receipt += ESCPOS.CUT;
  
  return receipt;
}

// Generate ESC/POS kitchen slip
function generateKitchenSlip(order: OrderData): string {
  let slip = ESCPOS.INIT;
  
  // Big header
  slip += ESCPOS.ALIGN_CENTER;
  slip += ESCPOS.BOLD_ON;
  slip += ESCPOS.DOUBLE_SIZE;
  slip += 'KITCHEN ORDER' + ESCPOS.LINE_FEED;
  slip += ESCPOS.LINE_FEED;
  slip += '#' + order.order_number.slice(-8) + ESCPOS.LINE_FEED;
  slip += ESCPOS.NORMAL_SIZE;
  slip += ESCPOS.BOLD_OFF;
  slip += ESCPOS.LINE_FEED;
  
  // Order type and table
  if (order.table_number) {
    slip += ESCPOS.DOUBLE_HEIGHT;
    slip += 'TABLE: ' + order.table_number + ESCPOS.LINE_FEED;
    slip += ESCPOS.NORMAL_SIZE;
  }
  slip += order.order_type.toUpperCase().replace('_', ' ') + ESCPOS.LINE_FEED;
  slip += '================================' + ESCPOS.LINE_FEED;
  slip += ESCPOS.LINE_FEED;
  
  // Items - BIG and clear
  slip += ESCPOS.ALIGN_LEFT;
  for (const item of order.items) {
    slip += ESCPOS.BOLD_ON;
    slip += ESCPOS.DOUBLE_HEIGHT;
    slip += item.qty + 'x ' + item.product_name + ESCPOS.LINE_FEED;
    slip += ESCPOS.NORMAL_SIZE;
    slip += ESCPOS.BOLD_OFF;
    
    // Modifiers
    if (item.modifiers && item.modifiers.length > 0) {
      for (const mod of item.modifiers) {
        slip += '   >> ' + mod.modifier_name + ESCPOS.LINE_FEED;
      }
    }
    
    // Special instructions
    if (item.special_instructions) {
      slip += ESCPOS.BOLD_ON;
      slip += '   NOTE: ' + item.special_instructions + ESCPOS.LINE_FEED;
      slip += ESCPOS.BOLD_OFF;
    }
    
    slip += ESCPOS.LINE_FEED;
  }
  
  slip += '================================' + ESCPOS.LINE_FEED;
  slip += ESCPOS.ALIGN_CENTER;
  slip += 'Items: ' + order.items.length + ' | Qty: ' + order.items.reduce((sum, i) => sum + i.qty, 0) + ESCPOS.LINE_FEED;
  slip += formatDateTime(order.created_at) + ESCPOS.LINE_FEED;
  slip += ESCPOS.LINE_FEED;
  slip += ESCPOS.LINE_FEED;
  slip += ESCPOS.LINE_FEED;
  slip += ESCPOS.CUT;
  
  return slip;
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-ZA') + ', ' + date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
}

// Attempt to send to network printer via HTTP
async function sendToPrinterHTTP(printerIp: string, port: number, data: string): Promise<{ success: boolean; error?: string }> {
  const endpoints = [
    `http://${printerIp}:${port}/print`,
    `http://${printerIp}/print`,
    `http://${printerIp}:${port}`,
    `http://${printerIp}/cgi-bin/epos/service.cgi`,
    `http://${printerIp}/StarWebPRNT/SendMessage`,
  ];
  
  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: data,
        signal: controller.signal,
      });
      
      clearTimeout(timeout);
      
      if (response.ok) {
        return { success: true };
      }
    } catch (e) {
      // Try next endpoint
      continue;
    }
  }
  
  return { success: false, error: 'Could not connect to printer at ' + printerIp };
}

// Log print attempt to database
async function logPrintAttempt(
  supabase: any,
  printerName: string,
  printerIp: string,
  orderId: string,
  printType: string,
  status: string,
  errorMessage?: string
) {
  try {
    await supabase.from('printer_logs').insert({
      printer_name: printerName,
      printer_ip: printerIp,
      order_id: orderId,
      print_type: printType,
      status: status,
      error_message: errorMessage,
    });
  } catch (e) {
    console.error('Failed to log print attempt:', e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header for print request');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Verify user authentication
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError || !user) {
      console.error('Print authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { order_id, order_data, print_type = 'both' } = await req.json();
    
    console.log('Print request received:', { order_id, print_type, user_id: user.id });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch printer settings
    const { data: printers, error: printerError } = await supabase
      .from('printer_settings')
      .select('*')
      .eq('is_active', true);

    if (printerError) {
      console.error('Failed to fetch printers:', printerError);
      throw new Error('Failed to fetch printer settings');
    }

    const receiptPrinter = printers?.find((p: any) => p.printer_type === 'receipt');
    const kitchenPrinter = printers?.find((p: any) => p.printer_type === 'kitchen');

    // Fetch branding
    const { data: branding } = await supabase
      .from('receipt_branding')
      .select('*')
      .limit(1)
      .single();

    // Generate print data
    const customerReceiptData = generateCustomerReceipt(order_data, branding);
    const kitchenSlipData = generateKitchenSlip(order_data);

    const results: {
      receipt: { success: boolean; error?: string };
      kitchen: { success: boolean; error?: string };
    } = {
      receipt: { success: false, error: 'No receipt printer configured' },
      kitchen: { success: false, error: 'No kitchen printer configured' },
    };

    // Print to both printers simultaneously
    const printPromises: Promise<void>[] = [];

    if ((print_type === 'both' || print_type === 'receipt') && receiptPrinter) {
      printPromises.push(
        sendToPrinterHTTP(receiptPrinter.ip_address, receiptPrinter.port || 9100, customerReceiptData)
          .then(async (result) => {
            results.receipt = result;
            await logPrintAttempt(
              supabase,
              receiptPrinter.name,
              receiptPrinter.ip_address,
              order_id,
              'receipt',
              result.success ? 'success' : 'failed',
              result.error
            );
          })
      );
    }

    if ((print_type === 'both' || print_type === 'kitchen') && kitchenPrinter) {
      printPromises.push(
        sendToPrinterHTTP(kitchenPrinter.ip_address, kitchenPrinter.port || 9100, kitchenSlipData)
          .then(async (result) => {
            results.kitchen = result;
            await logPrintAttempt(
              supabase,
              kitchenPrinter.name,
              kitchenPrinter.ip_address,
              order_id,
              'kitchen',
              result.success ? 'success' : 'failed',
              result.error
            );
          })
      );
    }

    // Wait for all print attempts
    await Promise.all(printPromises);

    console.log('Print results:', results);

    // Return results with fallback data for browser printing
    return new Response(
      JSON.stringify({
        success: true,
        results,
        fallback_data: {
          receipt: customerReceiptData,
          kitchen: kitchenSlipData,
        },
        message: getResultMessage(results),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Print error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

function getResultMessage(results: { receipt: { success: boolean }; kitchen: { success: boolean } }): string {
  if (results.receipt.success && results.kitchen.success) {
    return 'Receipt sent to Cashier and Kitchen Printers';
  } else if (results.receipt.success) {
    return 'Receipt sent to Cashier Printer (Kitchen printer unavailable)';
  } else if (results.kitchen.success) {
    return 'Receipt sent to Kitchen Printer (Cashier printer unavailable)';
  } else {
    return 'Network printers unavailable - using browser print';
  }
}
