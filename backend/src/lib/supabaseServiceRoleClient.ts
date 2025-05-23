// DEBUGGING: Log the key at the top of this file
console.log(`[DEBUG ServiceClient] SUPABASE_SERVICE_ROLE_KEY at top: '${process.env.SUPABASE_SERVICE_ROLE_KEY}'`);

import { createClient } from '@supabase/supabase-js';
// import dotenv from 'dotenv'; // dotenv is no longer needed here

// dotenv.config({ path: '.env' }); // REMOVE THIS LINE - .env should be loaded by the entry point

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL is not defined in the environment variables. Worker cannot start.');
}
if (!supabaseServiceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is not defined in the environment variables. Worker cannot start. This key is required for the worker to bypass RLS and fetch all subnets for polling.');
}

// Create a single supabase client for the service role
export const supabaseServiceRole = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    // Auto refresh token should be disabled for server-side clients
    autoRefreshToken: false,
    persistSession: false,
    // detectSessionInUrl: false // Default is true, but not relevant for server client
  }
});

console.log('Supabase service role client configured.'); 