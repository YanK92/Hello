import "server-only";
import { notFound, redirect } from "next/navigation";
import { createClient, currentUserId } from "@/lib/supabase/server";
import { loadCase } from "./load";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Signed-in user plus their case, or redirect to sign-in / 404. */
export async function requireCase(id: string, path = "") {
  if (!UUID.test(id)) notFound();
  const userId = await currentUserId();
  if (!userId) redirect(`/login?next=/cases/${id}${path}`);
  // RLS returns nothing for other users' cases, so this is a 404 for them.
  const data = await loadCase(id);
  if (!data) notFound();
  return { userId, data };
}

/** Like requireCase, but loads only the case title (for pages that load their own data). */
export async function requireCaseSummary(id: string, path = "") {
  if (!UUID.test(id)) notFound();
  const userId = await currentUserId();
  if (!userId) redirect(`/login?next=/cases/${id}${path}`);
  const supabase = await createClient();
  const { data } = await supabase.from("cases").select("id, title").eq("id", id).maybeSingle();
  if (!data) notFound();
  return { userId, caseId: data.id as string, title: data.title as string };
}

export function isUuid(value: string) {
  return UUID.test(value);
}
