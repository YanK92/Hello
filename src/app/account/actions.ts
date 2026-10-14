"use server";

import { redirect } from "next/navigation";
import { listEvidencePaths, removeEvidencePaths } from "@/lib/account/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, currentUserId } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/cases/evidence-actions";

/** Deletes a case, everything recorded in it, and its stored files. */
export async function deleteCase(caseId: string, confirmTitle: string): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Please sign in again." };
  const supabase = await createClient();
  const { data: c } = await supabase.from("cases").select("id, title").eq("id", caseId).maybeSingle();
  if (!c) return { ok: false, error: "Case not found." };
  if (confirmTitle.trim() !== c.title.trim()) return { ok: false, error: "Type the case title exactly to confirm." };

  // Files first, so nothing is left behind if the row delete succeeds.
  try {
    await removeEvidencePaths(supabase, await listEvidencePaths(supabase, `${userId}/${c.id}`));
  } catch {
    return { ok: false, error: "The files could not be deleted. Nothing was removed; please try again." };
  }
  const { error } = await supabase.from("cases").delete().eq("id", c.id);
  if (error) return { ok: false, error: "The case could not be deleted. Please try again." };
  redirect("/cases");
}

/** Deletes the account: all files, then the user (all rows cascade). */
export async function deleteAccount(confirm: string): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Please sign in again." };
  if (confirm.trim() !== "DELETE") return { ok: false, error: "Type DELETE to confirm." };

  const admin = createAdminClient();
  try {
    await removeEvidencePaths(admin, await listEvidencePaths(admin, userId));
  } catch {
    return { ok: false, error: "Your files could not be deleted. Nothing was removed; please try again." };
  }
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: "The account could not be deleted. Please try again." };
  // All other rows cascade with the user; audit rows are erased once the account is gone.
  await admin.from("audit_log").delete().eq("user_id", userId);

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/?account=deleted");
}
