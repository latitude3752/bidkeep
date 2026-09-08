/** Pure selection helpers for public teasers. Keep these free of I/O so
 * diversity / interleave behavior can be unit-tested without Supabase. */

/** First dotted SAM segment — "DEPT OF DEFENSE.DLA..." → "DEPT OF DEFENSE". */
export function agencyDepartment(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  return raw.split(".")[0].trim();
}

/** Walk `rows` in order and keep a row when any key is new; fill the rest
 * in original order up to `limit`. Input order is the priority (soonest
 * deadline, newest award, etc.). */
export function pickDiverseRows<T>(
  rows: T[],
  limit: number,
  keyFns: Array<(row: T) => string>
): T[] {
  if (limit <= 0 || rows.length === 0) return [];
  if (rows.length <= limit) return rows.slice();

  const picked: T[] = [];
  const pickedIdx = new Set<number>();
  const seen = keyFns.map(() => new Set<string>());

  const take = (i: number) => {
    picked.push(rows[i]);
    pickedIdx.add(i);
    keyFns.forEach((fn, k) => seen[k].add(fn(rows[i])));
  };

  for (let i = 0; i < rows.length && picked.length < limit; i++) {
    const adds = keyFns.some((fn, k) => !seen[k].has(fn(rows[i])));
    if (adds) take(i);
  }

  for (let i = 0; i < rows.length && picked.length < limit; i++) {
    if (!pickedIdx.has(i)) take(i);
  }

  return picked;
}

/** Round-robin across buckets so one program/agency cannot fill the teaser. */
export function interleaveByKey<T>(
  rows: T[],
  keyFn: (row: T) => string,
  limit: number
): T[] {
  if (limit <= 0 || rows.length === 0) return [];

  const buckets = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyFn(row);
    const list = buckets.get(key);
    if (list) list.push(row);
    else buckets.set(key, [row]);
  }

  const result: T[] = [];
  let depth = 0;
  while (result.length < limit) {
    let added = false;
    for (const list of buckets.values()) {
      if (depth < list.length) {
        result.push(list[depth]);
        added = true;
        if (result.length >= limit) break;
      }
    }
    if (!added) break;
    depth += 1;
  }
  return result;
}
