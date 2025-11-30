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
    const { amount, currency = 'ZAR', metadata, sale_id } = await req.json();

    // TODO: Replace with actual Yoco secret key when client provides it
    const YOCO_SECRET_KEY = 'sk_test_dummy_key_replace_with_real_key_960c73ed6b604966';
    
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
        },
      }),
    });

    const yocoData = await yocoResponse.json();

    if (!yocoResponse.ok) {
      throw new Error(yocoData.message || 'Yoco payment failed');
    }

    // Save transaction to database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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
        metadata: yocoData,
        processed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to save transaction');
    }

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
