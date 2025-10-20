import { createClient } from '@supabase/supabase-js';

// Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your environment variables
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const createServerClient = () =>
  createClient(supabaseUrl, supabaseServiceRoleKey);