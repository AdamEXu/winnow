const SQL_WORDS = new Set([
  "SELECT", "FROM", "WHERE", "GROUP", "ORDER", "BY", "AS", "WITH", "JOIN", "ON",
  "AND", "OR", "CASE", "WHEN", "THEN", "ELSE", "END", "DESC", "ASC",
]);

const PY_WORDS = new Set([
  "with", "as", "for", "in", "if", "not", "return", "import", "from", "def",
  "True", "False", "None", "and", "or",
]);

type Lang = "sql" | "python";

/** Enough highlighting to make the API surface legible — not a real lexer. */
function classOf(token: string, lang: Lang): string {
  if (/^#/.test(token) || /^--/.test(token)) return "text-ink3";
  if (/^["'`]/.test(token)) return "text-amber";
  if (/^\d/.test(token)) return "text-keep";
  const words = lang === "sql" ? SQL_WORDS : PY_WORDS;
  if (words.has(token)) return "text-line2";
  return "";
}

function highlight(line: string, lang: Lang): React.ReactNode[] {
  const comment = lang === "sql" ? line.indexOf("--") : line.indexOf("#");
  if (comment >= 0) {
    return [
      ...highlight(line.slice(0, comment), lang),
      <span key="c" className="text-ink3 italic">
        {line.slice(comment)}
      </span>,
    ];
  }
  return line
    .split(/(\s+|[(),.[\]{}=])/)
    .map((tok, i) =>
      tok.trim() === "" ? (
        tok
      ) : (
        <span key={i} className={classOf(tok, lang)}>
          {tok}
        </span>
      ),
    );
}

interface CodeProps {
  code: string;
  lang?: Lang;
  /** Caption printed above the block, e.g. the file it lives in. */
  source?: string;
}

export default function Code({ code, lang = "sql", source }: CodeProps) {
  const lines = code.replace(/\s+$/, "").split("\n");
  return (
    <figure className="bg-ink">
      {source && (
        <figcaption className="flex items-baseline justify-between border-b border-ink2/50 px-3.5 py-1.5 font-mono text-[11px] text-line2">
          <span>{source}</span>
          <span className="text-ink3">{lang}</span>
        </figcaption>
      )}
      <pre className="overflow-x-auto px-3.5 py-3 font-mono text-[12.5px] leading-[1.55] text-paper">
        <code>
          {lines.map((line, i) => (
            <span key={i} className="block">
              {highlight(line, lang)}
              {"\n"}
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}
