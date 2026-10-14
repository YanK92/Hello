/** Lists every object path under a storage prefix (folders have id null). */
export async function listAllPaths(
  prefix: string,
  list: (prefix: string, offset: number, limit: number) => Promise<{ name: string; id: string | null }[]>,
  pageSize = 1000,
): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await list(prefix, offset, pageSize);
    for (const item of page) {
      const path = `${prefix}/${item.name}`;
      if (item.id === null) out.push(...(await listAllPaths(path, list, pageSize)));
      else out.push(path);
    }
    if (page.length < pageSize) return out;
  }
}
