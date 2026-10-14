import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listAllPaths } from "./storage-walk";

/** Every evidence object under a prefix, using whichever client is given (RLS applies to user clients). */
export function listEvidencePaths(client: SupabaseClient, prefix: string) {
  return listAllPaths(prefix, async (p, offset, limit) => {
    const { data, error } = await client.storage.from("evidence").list(p, { limit, offset });
    if (error) throw error;
    return (data ?? []).map((o) => ({ name: o.name, id: o.id ?? null }));
  });
}

export async function removeEvidencePaths(client: SupabaseClient, paths: string[]) {
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await client.storage.from("evidence").remove(paths.slice(i, i + 100));
    if (error) throw error;
  }
}
