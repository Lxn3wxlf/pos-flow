import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

// Strict CORS - only allow same-origin requests in production
const getAllowedOrigins = (): string[] => {
  const origins = Deno.env.get('ALLOWED_ORIGINS');
  if (origins) {
    return origins.split(',').map(o => o.trim());
  }
  // Default allowed origins
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

// Rate limiting with IP-based tracking and exponential backoff
const rateLimitMap = new Map<string, { count: number; resetTime: number; lockoutUntil?: number }>();
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout after max attempts

function checkRateLimit(ip: string): { allowed: boolean; message?: string } {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  // Check if IP is in lockout
  if (record?.lockoutUntil && now < record.lockoutUntil) {
    const remainingMinutes = Math.ceil((record.lockoutUntil - now) / 60000);
    return { 
      allowed: false, 
      message: `Account locked. Try again in ${remainingMinutes} minutes.` 
    };
  }
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  
  if (record.count >= MAX_ATTEMPTS) {
    // Apply lockout
    record.lockoutUntil = now + LOCKOUT_DURATION_MS;
    return { 
      allowed: false, 
      message: 'Too many failed attempts. Account locked for 15 minutes.' 
    };
  }
  
  record.count++;
  return { allowed: true };
}

// Secure PIN hashing with environment-based salt
async function hashPIN(pin: string): Promise<string> {
  const salt = Deno.env.get('PIN_SALT') || 'mrtech-salt-2024';
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Validate and sanitize PIN input
function validatePIN(pin: unknown): { valid: boolean; error?: string } {
  if (!pin || typeof pin !== 'string') {
    return { valid: false, error: 'PIN is required' };
  }
  
  if (pin.length < 4 || pin.length > 6) {
    return { valid: false, error: 'PIN must be 4-6 digits' };
  }
  
  if (!/^\d+$/.test(pin)) {
    return { valid: false, error: 'PIN must contain only digits' };
  }
  
  return { valid: true };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
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
    // Get client IP for rate limiting
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';

    // Check rate limit with lockout
    const rateCheck = checkRateLimit(clientIP);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: rateCheck.message || 'Rate limit exceeded' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
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

    const { pin } = body as { pin?: unknown };
    
    // Validate PIN format
    const pinValidation = validatePIN(pin);
    if (!pinValidation.valid) {
      return new Response(
        JSON.stringify({ success: false, error: pinValidation.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Initialize Supabase client with service role (to bypass RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Hash the provided PIN
    const hashedPin = await hashPIN(pin as string);

    // Query for matching PIN hash - only return non-sensitive data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('pin_hash', hashedPin)
      .maybeSingle();

    if (profileError) {
      console.error('Database error during PIN verification');
      return new Response(
        JSON.stringify({ success: false, error: 'Verification failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!profile) {
      // Generic error message - don't reveal if PIN exists
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid credentials' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Get user role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', profile.id)
      .maybeSingle();

    if (roleError) {
      console.error('Role fetch error');
    }

    // Reset rate limit on successful login
    rateLimitMap.delete(clientIP);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: profile.id,
          full_name: profile.full_name,
          role: roleData?.role || 'cashier'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('PIN verification error:', error instanceof Error ? error.message : 'Unknown error');
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Verification failed'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
