"use client";

import { useEffect, useRef, useState } from "react";
import { IconDots } from "./icons";
import m from "./SaveMenu.module.css";

export type MoreItem = { label: string; icon: (p: { className?: string }) => React.ReactNode; onSelect: () => void; danger?: boolean };

// The "⋯" button: secondary actions for a chat, project or row, kept out of the way until asked for.
export function MoreMenu({ items, label, className }: { items: MoreItem[]; label: string; className: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className={m.root} ref={root}>
      <button className={className} onClick={() => setOpen((o) => !o)} aria-label={label} aria-expanded={open} aria-haspopup="menu" data-tip={open ? undefined : label} data-tip-pos="end">
        <IconDots />
      </button>
      {open && (
        <div className={`${m.menu} ${m.compact}`} role="menu">
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
