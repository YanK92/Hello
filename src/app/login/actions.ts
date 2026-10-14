"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

export interface AuthState {
  error?: string;
  message?: string;
}

const emailSchema = z.email("Enter a valid email address.");
const passwordSchema = z.string().min(8, "Use at least 8 characters for your password.");

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function field(form: FormData, key: string) {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

export async function passwordAuth(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = emailSchema.safeParse(field(form, "email").trim());
  if (!email.success) return { error: email.error.issues[0].message };
  const password = passwordSchema.safeParse(field(form, "password"));
  if (!password.success) return { error: password.error.issues[0].message };

  const next = safeNextPath(field(form, "next"));
  const supabase = await createClient();

  if (field(form, "intent") === "sign-up") {
    const { data, error } = await supabase.auth.signUp({
      email: email.data,
      password: password.data,
      options: {
        emailRedirectTo: `${siteUrl()}/auth/confirm?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) return { error: error.message };
    if (!data.session) {
      return { message: "Check your email to confirm your account, then sign in." };
    }
  } else {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.data,
      password: password.data,
    });
    if (error) return { error: "Email or password not recognised." };
  }

  redirect(next);
}

export async function magicLink(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = emailSchema.safeParse(field(form, "email").trim());
  if (!email.success) return { error: email.error.issues[0].message };

  const next = safeNextPath(field(form, "next"));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: `${siteUrl()}/auth/confirm?next=${encodeURIComponent(next)}` },
  });
  if (error) return { error: error.message };
  return { message: "If that address can sign in, a link is on its way. Check your email." };
}
