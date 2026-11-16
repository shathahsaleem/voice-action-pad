import { createClient } from "@supabase/supabase-js";

export function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !secretKey) {
    throw new Error("Missing Supabase environment variables in .env.local");
  }

  return createClient(supabaseUrl, secretKey, {
    auth: {
      persistSession: false,
    },
  });
}