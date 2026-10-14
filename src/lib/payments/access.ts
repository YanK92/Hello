import "server-only";
import { createClient } from "@/lib/supabase/server";
import { paywallEnabled } from "./stripe";

export const PAID_FEATURE_MESSAGE = "This is part of the paid plan. See Upgrade for details.";

/** True if the signed-in user can use paid features (always true when payments are off). */
export async function hasPaidAccess(): Promise<boolean> {
  if (!paywallEnabled()) return true;
  const supabase = await createClient();
  const { data } = await supabase.rpc("has_paid_access");
  return data === true;
}
