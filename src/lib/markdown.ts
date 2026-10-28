// The small markdown the replies use: paragraphs, bullet and numbered lists, **bold**, *italic*, `code` and
// [links](https://…). Anything else stays text. No HTML ever passes through: the renderer builds elements from this.

export type Inline = { t: "text"; v: string } | { t: "b" | "i"; c: Inline[] } | { t: "code"; v: string } | { t: "a"; href: string; c: Inline[] };
export type Block = { t: "p"; c: Inline[] } | { t: "ul" | "ol"; items: Inline[][]; start?: number };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBER = /^\s*(\d{1,3})[.)]\s+(.*)$/;

export function parseBlocks(src: string): Block[] {
  const out: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ t: "p", c: parseInline(para.join(" ")) });
    para = [];
  };
  for (const raw of src.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const b = line.match(BULLET);
    const n = b ? null : line.match(NUMBER);
    if (!line.trim()) {
      flush();
      continue;
    }
    if (b || n) {
      flush();
      const kind = b ? "ul" : "ol";
      const text = b ? b[1] : n![2];
      const last = out[out.length - 1];
      if (last && last.t === kind) last.items.push(parseInline(text));
      else out.push(kind === "ol" ? { t: "ol", items: [parseInline(text)], start: Number(n![1]) } : { t: "ul", items: [parseInline(text)] });
      continue;
    }
    // a line right under a list item, indented, continues that item
    const last = out[out.length - 1];
    if (!para.length && last && last.t !== "p" && /^\s{2,}\S/.test(raw)) {
      const item = last.items[last.items.length - 1];
      item.push({ t: "text", v: " " }, ...parseInline(line.trim()));
      continue;
    }
    para.push(line.trim().replace(/^#{1,6}\s+/, ""));
  }
  flush();
  return out;
}

const safeHref = (h: string) => (/^https?:\/\//i.test(h) ? h : undefined);

export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  let text = "";
  const push = (node: Inline) => {
    if (text) out.push({ t: "text", v: text });
    text = "";
    out.push(node);
  };
  let i = 0;
  while (i < s.length) {
    const rest = s.slice(i);
    let m: RegExpMatchArray | null;
    if ((m = rest.match(/^`([^`\n]+)`/))) push({ t: "code", v: m[1] });
    else if ((m = rest.match(/^\*\*(?=\S)([\s\S]*?\S)\*\*/)) || (m = rest.match(/^__(?=\S)([\s\S]*?\S)__/))) push({ t: "b", c: parseInline(m[1]) });
    else if ((m = rest.match(/^\*(?=[^\s*])([^*\n]*?[^\s*])\*(?!\*)/)) || (/^\W?$/.test(s[i - 1] ?? "") && (m = rest.match(/^_(?=\S)([^_\n]*?\S)_(?!\w)/)))) push({ t: "i", c: parseInline(m[1]) });
    else if ((m = rest.match(/^\[([^\]\n]+)\]\(([^)\s]+)\)/)) && safeHref(m[2])) push({ t: "a", href: m[2], c: parseInline(m[1]) });
    else {
      text += s[i];
      i++;
      continue;
    }
    i += m[0].length;
  }
  if (text) out.push({ t: "text", v: text });
  return out;
}

/** The words alone, as the number check and the copy button see them. */
export const plainOf = (nodes: Inline[]): string => nodes.map((n) => (n.t === "text" || n.t === "code" ? n.v : plainOf(n.c))).join("");
