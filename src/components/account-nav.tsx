import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { currentUserId } from "@/lib/supabase/server";

export async function AccountNav() {
  const userId = isSupabaseConfigured() ? await currentUserId() : null;

  if (!userId) {
    return (
      <Link href="/login" className="button" data-variant="secondary">
        Sign in
      </Link>
    );
  }

  return (
    <nav style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: "var(--space-3)", alignItems: "center" }}>
      <Link href="/cases">My cases</Link>
      <Link href="/account">Account</Link>
      <form action="/auth/signout" method="post">
        <button type="submit" className="button" data-variant="secondary">
          Sign out
        </button>
      </form>
    </nav>
  );
}
