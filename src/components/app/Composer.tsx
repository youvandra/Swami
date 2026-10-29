"use client";

import { useEffect, useRef, useState } from "react";
import type { Mode } from "@/lib/agent/types";
import Link from "next/link";
import { parseRoster } from "@/lib/roster";
import { useRosters } from "@/lib/store";
import { IconArrowUp, IconCheck, IconChevron, IconClip, IconPlus, IconSpark, IconStop } from "./icons";
import { Dropdown } from "./ui/Dropdown";
import s from "./Composer.module.css";
import m from "./SaveMenu.module.css";

export type AttachedRoster = { name: string; acts: string[] };

export const MODES: { id: Mode; label: string }[] = [
  { id: "auto", label: "Any Tool" },
  { id: "opener", label: "Find Openers" },
  { id: "map", label: "Crowd Map" },
  { id: "routing", label: "Tour Routing" },
  { id: "venues", label: "Venues" },
  { id: "partners", label: "Co-promo" },
  { id: "sponsors", label: "Sponsors" },
  { id: "audience", label: "Audience" },
  { id: "proposal", label: "Proposal" },
  { id: "email", label: "Email" },
];

type Props = {
  onSend: (text: string, roster?: AttachedRoster) => void;
  mode: Mode;
  onMode: (m: Mode) => void;
  busy: boolean;
  onStop?: () => void;
  /** Viewers read the workspace; the composer says so instead of taking input. */
  readOnly?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
};

export function Composer({ onSend, mode, onMode, busy, onStop, readOnly, placeholder = "Ask about a show, a tour or a pitch…", autoFocus }: Props) {
  const [text, setText] = useState("");
  const [roster, setRoster] = useState<AttachedRoster | null>(null);
  const [menu, setMenu] = useState(false);
  const rosters = useRosters();
  const ref = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const menuRoot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !menuRoot.current?.contains(e.target as Node) && setMenu(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  // grow with the text, up to ~8 lines
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const canSend = text.trim().length > 0 && !busy && !readOnly;
  const submit = () => {
    if (!canSend) return;
    onSend(text.trim(), roster ?? undefined);
    setText("");
    setRoster(null);
  };

  return (
    <form
      className={s.composer}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {roster && (
        <div className={s.attachment}>
          <IconClip />
          <span>
            {roster.name} · {roster.acts.length} acts
          </span>
          <button type="button" onClick={() => setRoster(null)} aria-label="Remove roster">
            ×
          </button>
        </div>
      )}
      <textarea
        ref={ref}
        className={s.input}
        rows={1}
        value={text}
        autoFocus={autoFocus && !readOnly}
        disabled={readOnly}
        placeholder={readOnly ? "You can read this workspace. Ask an owner for edit access to chat." : placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        aria-label="Message"
      />
      <div className={s.bar}>
        <div className={m.root} ref={menuRoot}>
          <button type="button" className={s.tool} data-on={roster ? "" : undefined} onClick={() => setMenu((o) => !o)} aria-expanded={menu} aria-haspopup="menu">
            <IconClip />
            <span>Roster</span>
          </button>
          {menu && (
            <div className={`${m.menu} ${s.menuUp}`} role="menu">
              <p className={m.label}>Rank Inside a Roster</p>
              <ul>
                {rosters.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={roster?.name === r.name}
                      onClick={() => {
                        setRoster(roster?.name === r.name ? null : { name: r.name, acts: r.acts.map((a) => a.name) });
                        setMenu(false);
                        ref.current?.focus();
                      }}
                    >
                      <span className={m.name}>{r.name}</span>
                      <em>{r.acts.length}</em>
                      <span className={m.check}>{roster?.name === r.name && <IconCheck />}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className={m.new} onClick={() => file.current?.click()}>
                <IconPlus />
                Attach a file for this message
              </button>
              <Link href="/app/settings?tab=rosters" className={m.new}>
                <IconClip />
                Manage Rosters
              </Link>
            </div>
          )}
        </div>
        <input
          ref={file}
          type="file"
          accept=".csv,.txt"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            const acts = parseRoster(await f.text()).map((a) => a.name);
            if (acts.length) setRoster({ name: f.name.replace(/\.\w+$/, ""), acts });
            setMenu(false);
          }}
        />
        <Dropdown className={s.mode} label="Tool" value={mode} options={MODES.map((m) => ({ value: m.id, label: m.label }))} onChange={onMode}>
          <IconSpark className={s.modeIcon} weight="duotone" />
          {MODES.find((m) => m.id === mode)?.label}
          <IconChevron />
        </Dropdown>
        {busy && onStop ? (
          <button type="button" className={s.send} onClick={onStop} aria-label="Stop" data-tip="Stop · Esc" data-tip-pos="end">
            <IconStop />
          </button>
        ) : (
          <button type="submit" className={s.send} disabled={!canSend} aria-label="Send" data-tip="Send · Enter" data-tip-pos="end">
            <IconArrowUp />
          </button>
        )}
      </div>
    </form>
  );
}
