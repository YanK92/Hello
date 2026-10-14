import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseEnv } from "@/lib/supabase/env";

/** Uptime check: the app is serving and can reach Supabase. No user data. */
export async function GET() {
  const started = Date.now();
  let database: "ok" | "unreachable" | "not_configured" = "not_configured";
  if (isSupabaseConfigured()) {
    const { url, key } = supabaseEnv();
    try {
      const res = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key }, cache: "no-store", signal: AbortSignal.timeout(5000) });
      database = res.ok ? "ok" : "unreachable";
    } catch {
      database = "unreachable";
    }
  }
  const healthy = database !== "unreachable";
  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", supabase: database, ms: Date.now() - started },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
