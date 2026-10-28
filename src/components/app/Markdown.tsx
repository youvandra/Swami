import type { ReactNode } from "react";
import { parseBlocks, type Inline } from "@/lib/markdown";
import s from "./Markdown.module.css";

// Elements built from the parsed tree, never from HTML, so a reply can only ever show text, lists and links.
function inline(nodes: Inline[]): ReactNode[] {
  return nodes.map((n, i) => {
    switch (n.t) {
      case "text":
        return n.v;
      case "b":
        return <strong key={i}>{inline(n.c)}</strong>;
      case "i":
        return <em key={i}>{inline(n.c)}</em>;
      case "code":
        return <code key={i}>{n.v}</code>;
      case "a":
        return (
          <a key={i} href={n.href} target="_blank" rel="noopener noreferrer">
            {inline(n.c)}
          </a>
        );
    }
  });
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  // replies are short, so the whole buffer is parsed on every streamed delta
  const blocks = parseBlocks(text);
  return (
    <div className={`${s.md} ${className ?? ""}`}>
      {blocks.map((b, i) =>
        b.t === "p" ? (
          <p key={i}>{inline(b.c)}</p>
        ) : b.t === "ul" ? (
          <ul key={i}>
            {b.items.map((it, j) => (
              <li key={j}>{inline(it)}</li>
            ))}
          </ul>
        ) : (
          <ol key={i} start={b.start}>
            {b.items.map((it, j) => (
              <li key={j}>{inline(it)}</li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}
