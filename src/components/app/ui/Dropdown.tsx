"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { IconCheck } from "../icons";
import s from "./Dropdown.module.css";

export type Option<T extends string> = { value: T; label: string; hint?: string; lead?: ReactNode };

type Props<T extends string> = {
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  /** Read aloud for the trigger, and the sheet's heading on a phone. */
  label: string;
  /** What the trigger shows; the selected option's label by default. */
  children?: ReactNode;
  className?: string;
  align?: "start" | "end";
  disabled?: boolean;
  /** Marks the trigger as holding a choice (data-set), for triggers that look empty until one is made. */
  set?: boolean;
};

// The app's select: a button and a list with a check on the chosen option. Arrows, Home/End, Enter, Esc and
// type-ahead work; focus goes back to the button; the list opens upward near the bottom of the screen and as a
// sheet on a phone.
export function Dropdown<T extends string>({ value, options, onChange, label, children, className, align = "start", disabled, set }: Props<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [up, setUp] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const id = useId();
  const selected = options.find((o) => o.value === value);

  const show = () => {
    const r = button.current?.getBoundingClientRect();
    setUp(!!r && window.innerHeight - r.bottom < Math.min(320, 44 * options.length + 24) && r.top > window.innerHeight - r.bottom);
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };
  const pick = (i: number) => {
    const o = options[i];
    if (o) onChange(o.value);
    close();
  };

  useEffect(() => {
    if (!open) return;
    list.current?.focus();
    const away = (e: MouseEvent) => !root.current?.contains(e.target as Node) && close(false);
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onKey = (e: React.KeyboardEvent) => {
    const n = options.length;
    if (e.key === "ArrowDown") setActive((i) => (i + 1) % n);
    else if (e.key === "ArrowUp") setActive((i) => (i - 1 + n) % n);
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(n - 1);
    else if (e.key === "Enter" || e.key === " ") pick(active);
    else if (e.key === "Escape" || e.key === "Tab") close(e.key === "Escape");
    else if (e.key.length === 1 && /\S/.test(e.key)) {
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 600 ? typed.current.text : "") + e.key.toLowerCase(), at: now };
      const hit = options.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text));
      if (hit >= 0) setActive(hit);
      return;
    } else return;
    e.preventDefault();
  };

  return (
    <div className={s.root} ref={root}>
      <button
        ref={button}
        type="button"
        className={className ?? s.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={selected ? `${label}: ${selected.label}` : label}
        data-set={set || undefined}
        disabled={disabled}
        onClick={() => (open ? close() : show())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            show();
          }
        }}
      >
        {children ?? selected?.label}
      </button>
      {open && (
        <>
          <div className={s.scrim} aria-hidden onClick={() => close()} />
          <div className={s.pop} data-up={up || undefined} data-align={align}>
            <p className={s.sheetTitle}>{label}</p>
            <ul ref={list} id={id} role="listbox" aria-label={label} tabIndex={-1} aria-activedescendant={`${id}-${active}`} onKeyDown={onKey}>
              {options.map((o, i) => (
                <li
                  key={o.value}
                  id={`${id}-${i}`}
                  role="option"
                  aria-selected={o.value === value}
                  data-active={i === active || undefined}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(i)}
                >
                  {o.lead}
                  <span className={s.text}>
                    <span className={s.name}>{o.label}</span>
                    {o.hint && <span className={s.hint}>{o.hint}</span>}
                  </span>
                  <span className={s.check}>{o.value === value && <IconCheck />}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
