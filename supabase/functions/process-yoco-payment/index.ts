import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Strict CORS configuration
const getAllowedOrigins = (): string[] => {
  const origins = Deno.env.get('ALLOWED_ORIGINS');
  if (origins) {
    return origins.split(',').map(o => o.trim());
  }
  return [
    'https://lovable.dev',
    'https://*.lovable.dev',
    'http://localhost:5173',
    'http://localhost:3000',
  ];
};

const getCorsHeaders = (origin: string | null): Record<string, string> => {
  const allowedOrigins = getAllowedOrigins();
  const isAllowed = origin && allowedOrigins.some(allowed => {
    if (allowed.includes('*')) {
      const pattern = new RegExp('^' + allowed.replace('*', '.*') + '$');
      return pattern.test(origin);
    }
    return allowed === origin;
  });
  
  return {
    'Access-Control-Allow-Origin': isAllowed && origin ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
  };
};

// Input validation
function validatePaymentInput(data: unknown): { valid: boolean; error?: string; sanitized?: { amount: number; currency: string; metadata?: Record<string, unknown>; sale_id?: string } } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const { amount, currency, metadata, sale_id } = data as Record<string, unknown>;

  // Validate amount
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return { valid: false, error: 'Amount must be a valid number' };
  }
  
  if (amount <= 0) {
    return { valid: false, error: 'Amount must be positive' };
  }
  
  if (amount > 1000000) { // Max 1 million ZAR
    return { valid: false, error: 'Amount exceeds maximum limit' };
  }

  // Validate currency
  const validCurrency = typeof currency === 'string' ? currency.toUpperCase() : 'ZAR';
  if (!['ZAR', 'USD', 'EUR', 'GBP'].includes(validCurrency)) {
    return { valid: false, error: 'Invalid currency' };
  }

  // Validate sale_id if provided (UUID format)
  if (sale_id !== undefined && sale_id !== null) {
    if (typeof sale_id !== 'string') {
      return { valid: false, error: 'Invalid sale_id format' };
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sale_id)) {
      return { valid: false, error: 'Invalid sale_id format' };
    }
  }

  return {
    valid: true,
    sanitized: {
      amount: Math.round(amount * 100) / 100, // Round to 2 decimal places
      currency: validCurrency,
      metadata: metadata && typeof metadata === 'object' ? metadata as Record<string, unknown> : undefined,
      sale_id: sale_id as string | undefined,
    }
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
    );
  }

  try {
    // Authenticate the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    // Create client with user's token to verify authentication
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Create service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user has cashier or admin role
    const { data: roleCheck } = await supabase.rpc('has_role', { 
      _user_id: user.id, 
      _role: 'cashier' 
    });
    
    const { data: adminCheck } = await supabase.rpc('has_role', { 
      _user_id: user.id, 
      _role: 'admin' 
    });

    if (!roleCheck && !adminCheck) {
      return new Response(
        JSON.stringify({ success: false, error: 'Insufficient permissions' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request body' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const validation = validatePaymentInput(body);
    if (!validation.valid || !validation.sanitized) {
      return new Response(
        JSON.stringify({ success: false, error: validation.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { amount, currency, metadata, sale_id } = validation.sanitized;

    // Get Yoco key from environment variable (secure)
    const YOCO_SECRET_KEY = Deno.env.get('YOCO_SECRET_KEY');
    
    if (!YOCO_SECRET_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'Payment system not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    // Yoco API endpoint for creating payments
    const yocoResponse = await fetch('https://online.yoco.com/v1/charges/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${YOCO_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        metadata: {
          ...metadata,
          sale_id,
          processed_by: user.id, // Audit trail
        },
      }),
    });

    const yocoData = await yocoResponse.json();

    if (!yocoResponse.ok) {
      // Don't expose raw Yoco errors to client
      return new Response(
        JSON.stringify({ success: false, error: 'Payment processing failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Save transaction to database
    const { data: transaction, error: dbError } = await supabase
      .from('payment_transactions')
      .insert({
        sale_id,
        amount,
        currency,
        payment_provider: 'yoco',
        payment_method: 'card',
        status: yocoData.status || 'successful',
        provider_transaction_id: yocoData.id,
        metadata: { transaction_id: yocoData.id, processed_by: user.id },
        processed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error saving transaction');
      // Payment succeeded but DB save failed - log but don't fail the request
    }

    return new Response(
      JSON.stringify({
        success: true,
        transaction_id: transaction?.id,
        status: yocoData.status,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Payment processing error:', error instanceof Error ? error.message : 'Unknown error');
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Payment processing failed',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
