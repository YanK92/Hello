import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

/**
 * Service-role client. Bypasses RLS, so use it only for the narrow jobs the
 * user's own client is not allowed to do (recording evidence after hashing
 * the stored file, recording integrity re-checks), and only after checking
 * the signed-in user owns the case.
 */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("Missing SUPABASE_SECRET_KEY. See .env.example.");
  return createClient(supabaseEnv().url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
