"use client";

import { useEffect, useRef, useState } from "react";
import { IconDots } from "./icons";
import m from "./SaveMenu.module.css";

export type MoreItem = { label: string; icon: (p: { className?: string }) => React.ReactNode; onSelect: () => void; danger?: boolean };

// The "⋯" button: secondary actions for a chat, project or row, kept out of the way until asked for.
// `floating` pins the menu to the viewport, for triggers inside a scrolling list that would clip it.
export function MoreMenu({ items, label, className, rootClassName, floating }: { items: MoreItem[]; label: string; className: string; rootClassName?: string; floating?: boolean }) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<React.CSSProperties | undefined>(undefined);
  const root = useRef<HTMLDivElement>(null);

  const toggle = () => {
    if (!open && floating && root.current) {
      const r = root.current.getBoundingClientRect();
      const below = window.innerHeight - r.bottom > 44 * items.length + 24;
      setAt({ position: "fixed", left: Math.max(8, Math.min(r.left, window.innerWidth - 208)), right: "auto", ...(below ? { top: r.bottom + 6 } : { top: "auto", bottom: window.innerHeight - r.top + 6 }) });
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const away = () => setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    if (floating) window.addEventListener("scroll", away, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", away, true);
    };
  }, [open, floating]);

  return (
    <div className={rootClassName ? `${m.root} ${rootClassName}` : m.root} ref={root} data-open={open || undefined}>
      <button className={className} onClick={toggle} aria-label={label} aria-expanded={open} aria-haspopup="menu" data-tip={open ? undefined : label} data-tip-pos="end">
        <IconDots />
      </button>
      {open && (
        <div className={`${m.menu} ${m.compact}`} role="menu" style={floating ? at : undefined}>
          <ul>
            {items.map((it) => (
              <li key={it.label}>
                <button
                  role="menuitem"
                  className={it.danger ? m.danger : undefined}
                  onClick={() => {
                    setOpen(false);
                    it.onSelect();
                  }}
                >
                  <it.icon className={m.itemIcon} />
                  <span className={m.name}>{it.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
