import { useEffect, useState } from "react";
import type { Data, QueryLog } from "../types";

function load<T>(file: string): Promise<T> {
  return fetch(`./${file}`).then((r) => {
    if (!r.ok) throw new Error(`${file} returned HTTP ${r.status}`);
    return r.json() as Promise<T>;
  });
}

export function useData(): { data: Data | null; queries: QueryLog | null; error: string | null } {
  const [data, setData] = useState<Data | null>(null);
  const [queries, setQueries] = useState<QueryLog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    load<Data>("data.json")
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      });
    // The query log is a bonus artifact; the page still stands without it.
    load<QueryLog>("querylog.json")
      .then((q) => {
        if (alive) setQueries(q);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return { data, queries, error };
}
