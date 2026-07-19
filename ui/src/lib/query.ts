import type { Episode } from "../types";
import { metricValue } from "./metrics";

export type Op = "<" | "<=" | ">" | ">=";
export const OPS: readonly Op[] = ["<", "<=", ">", ">="];

export interface Clause {
  id: number;
  metric: string;
  op: Op;
  value: number;
}

export function clausePasses(e: Episode, c: Clause): boolean {
  const v = metricValue(e, c.metric);
  switch (c.op) {
    case "<":
      return v < c.value;
    case "<=":
      return v <= c.value;
    case ">":
      return v > c.value;
    case ">=":
      return v >= c.value;
  }
}

export function episodePasses(e: Episode, clauses: Clause[]): boolean {
  return clauses.every((c) => clausePasses(e, c));
}

export function fmtClauseValue(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return String(+v.toFixed(3));
}

export function whereString(clauses: Clause[]): string {
  return clauses
    .map((c) => `${c.metric} ${c.op} ${fmtClauseValue(c.value)}`)
    .join(" AND ");
}
