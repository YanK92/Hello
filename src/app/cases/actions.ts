"use server";

import { redirect } from "next/navigation";
import { parseNewCase } from "@/lib/validation/case";
import { createClient, currentUserId } from "@/lib/supabase/server";

export interface CaseFormState {
  errors?: Partial<Record<string, string>>;
  formError?: string;
}

export async function createCase(_prev: CaseFormState, form: FormData): Promise<CaseFormState> {
  const parsed = parseNewCase(form);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      errors[key] ??= issue.message;
    }
    return { errors };
  }

  if (!(await currentUserId())) redirect("/login?next=/cases/new");

  const supabase = await createClient();
  // user_id defaults to auth.uid() in the database; RLS rejects anything else.
  const { data, error } = await supabase.from("cases").insert(parsed.data).select("id").single();
  if (error || !data) {
    return { formError: "The case could not be saved. Please try again." };
  }

  redirect(`/cases/${data.id}`);
}
