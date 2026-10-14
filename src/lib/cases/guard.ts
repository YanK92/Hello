import "server-only";
import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/supabase/server";
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
