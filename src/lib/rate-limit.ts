import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Per-user limits per hour. Generous for real use; there to stop abuse and runaway scripts. */
export const LIMITS = {
  upload: 200,
  entry: 300,
  export: 20,
  transcribe: 30,
  transcript_import: 60,
  search: 300,
  sar: 60,
  note: 600,
  checkout: 10,
  account_export: 5,
} as const;

export type LimitedAction = keyof typeof LIMITS;

export const RATE_LIMIT_MESSAGE = "Too many requests in a short time. Please wait a while and try again.";

/**
 * Counts one use of `action` for the signed-in user. Returns false once the
 * hourly limit is reached. If the check itself fails, the request is allowed
 * (a limiter outage should not lock people out of their evidence).
 */
export async function withinLimit(action: LimitedAction): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rate_limit", {
    p_action: action,
    p_limit: LIMITS[action],
    p_window_seconds: 3600,
  });
  if (error) {
    console.error(JSON.stringify({ level: "warn", msg: "rate limit check failed", action, error: error.message }));
    return true;
  }
  return data === true;
}
