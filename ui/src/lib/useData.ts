import { useEffect, useState } from "react";
import type { Data } from "../types";

export function useData(): { data: Data | null; error: string | null } {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("./data.json")
      .then((r) => {
        if (!r.ok) throw new Error(`data.json returned HTTP ${r.status}`);
        return r.json();
      })
      .then((d: Data) => {
        if (alive) setData(d);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      alive = false;
    };
  }, []);

  return { data, error };
}
