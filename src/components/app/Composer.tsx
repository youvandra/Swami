"use client";

import { useEffect, useRef, useState } from "react";
import type { Mode } from "@/lib/agent/types";
import { IconArrowUp, IconChevron, IconClip } from "./icons";
import s from "./Composer.module.css";

export const MODES: { id: Mode; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "opener", label: "Find openers" },
  { id: "map", label: "Crowd map" },
  { id: "routing", label: "Tour routing" },
  { id: "venues", label: "Venues" },
  { id: "partners", label: "Co-promo" },
  { id: "sponsors", label: "Sponsors" },
  { id: "audience", label: "Audience" },
  { id: "proposal", label: "Proposal" },
  { id: "email", label: "Email" },
];

type Props = {
  onSend: (text: string) => void;
  mode: Mode;
  onMode: (m: Mode) => void;
  busy: boolean;
  placeholder?: string;
  autoFocus?: boolean;
};

export function Composer({ onSend, mode, onMode, busy, placeholder = "Ask Swami about a show, a tour leg or a pitch…", autoFocus }: Props) {
  const [text, setText] = useState("");
  const [roster, setRoster] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);

  // grow with the text, up to ~8 lines
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const canSend = text.trim().length > 0 && !busy;
  const submit = () => {
    if (!canSend) return;
    onSend(roster ? `${text.trim()}\n\nRoster: ${roster}` : text.trim());
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
          <span>{roster}</span>
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
        autoFocus={autoFocus}
        placeholder={placeholder}
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
        <button type="button" className={s.tool} onClick={() => file.current?.click()}>
          <IconClip />
          <span>Roster</span>
        </button>
        <input
          ref={file}
          type="file"
          accept=".csv,.txt"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setRoster(f.name);
            e.target.value = "";
          }}
        />
        <label className={s.mode}>
          <select value={mode} onChange={(e) => onMode(e.target.value as Mode)} aria-label="Mode">
            {MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <IconChevron />
        </label>
        <span className={s.hint}>Shift + Enter for a new line</span>
        <button type="submit" className={s.send} disabled={!canSend} aria-label="Send">
          <IconArrowUp />
        </button>
      </div>
    </form>
  );
}
