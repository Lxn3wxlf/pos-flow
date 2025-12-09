import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create client with user's token to verify authentication
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication failed:', authError?.message);
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
      console.error('User lacks required role:', user.id);
      return new Response(
        JSON.stringify({ success: false, error: 'Insufficient permissions' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const { amount, currency = 'ZAR', metadata, sale_id } = await req.json();

    // Get Yoco key from environment variable (secure)
    const YOCO_SECRET_KEY = Deno.env.get('YOCO_SECRET_KEY');
    
    if (!YOCO_SECRET_KEY) {
      console.error('YOCO_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Payment system not configured. Please add YOCO_SECRET_KEY.' }),
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
      throw new Error(yocoData.message || 'Yoco payment failed');
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
        metadata: { ...yocoData, processed_by: user.id },
        processed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to save transaction');
    }

    console.log(`Payment processed by user ${user.id} for amount ${amount}`);

    return new Response(
      JSON.stringify({
        success: true,
        transaction,
        yoco_response: yocoData,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Payment processing error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
