import type { QueryTable } from "../../types";

interface ResultTableProps {
  table: QueryTable;
  /** Printed above the table — what the query returned, in plain words. */
  caption?: string;
  /** Columns to render wide and wrapped rather than as a number. */
  wrap?: string[];
}

function fmt(v: string | number | null): string {
  if (v === null) return "—";
  if (typeof v === "string") return v;
  return Number.isInteger(v) ? v.toLocaleString("en-US") : String(v);
}

/** A query result, shown as the query returned it. */
export default function ResultTable({ table, caption, wrap = [] }: ResultTableProps) {
  // Numbers read right-aligned; labels read left-aligned.
  const numeric = table.columns.map(
    (_, i) => i > 0 && table.rows.every((r) => typeof r[i] === "number"),
  );
  return (
    <figure className="border border-line2 bg-mount">
      {caption && (
        <figcaption className="border-b border-line px-3 py-1.5 font-mono text-[11px] text-ink2">
          {caption}
        </figcaption>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-mono text-[12px]">
          <thead>
            <tr className="border-b border-line2">
              {table.columns.map((c, i) => (
                <th
                  key={c}
                  scope="col"
                  className={`px-3 py-1.5 text-[10.5px] tracking-wide text-ink3 uppercase ${
                    numeric[i] ? "text-right" : "text-left"
                  }`}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, r) => (
              <tr key={r} className="border-b border-line last:border-b-0">
                {row.map((v, i) => (
                  <td
                    key={i}
                    className={`px-3 py-1 whitespace-nowrap ${
                      i === 0 ? "font-medium text-ink" : "text-ink2"
                    } ${numeric[i] ? "text-right" : ""} ${
                      wrap.includes(table.columns[i]) ? "text-[11px] whitespace-normal" : ""
                    }`}
                  >
                    {fmt(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
