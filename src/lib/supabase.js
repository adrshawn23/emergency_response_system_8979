import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
// Supabase now provisions publishable keys for browser clients. Keep the
// legacy anon name as a fallback for existing deployments.
const supabasePublishableKey = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env?.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  }
});
