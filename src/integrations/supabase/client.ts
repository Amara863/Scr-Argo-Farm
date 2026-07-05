import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://kthfvvkryvpxkdpkfsic.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0aGZ2dmtyeXZweGtkcGtmc2ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MDMyNTAsImV4cCI6MjA5NTI3OTI1MH0.dZA_6jpZIQgAanU-Hq0ystH5J2yyiagpYqv5FiT_WFQ";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);