"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseRoster } from "@/lib/roster";
import { saveRoster } from "@/lib/store";
import type { Roster } from "@/lib/model";
import { IconClip, IconClose } from "../icons";
import d from "../projects/ProjectDialog.module.css";
import s from "./Settings.module.css";

// Import a roster from pasted text or a CSV/TXT file, with a live preview of what was understood.
export function RosterDialog({ onClose, onSaved }: { onClose: () => void; onSaved: (r: Roster) => void }) {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<string | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const acts = useMemo(() => parseRoster(text), [text]);

  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);

  return (
    <dialog ref={ref} className={d.dialog} onCancel={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <form
        className={d.form}
        onSubmit={(e) => {
          e.preventDefault();
          if (!acts.length) return;
          onSaved(saveRoster(name.trim() || file?.replace(/\.\w+$/, "") || "New roster", acts));
        }}
      >
        <header className={d.head}>
          <h2>Import a roster</h2>
          <button type="button" className={d.close} onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </header>
        <label className={d.field}>
          <span>Roster name</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Northlight Agency · spring" />
        </label>
        <div className={d.field}>
          <span>Acts</span>
          <textarea className={s.paste} value={text} onChange={(e) => setText(e.target.value)} rows={7} placeholder={"Paste one act per line, Act, Genre lines, or a CSV export\nHalcyon Drive, Indie rock\nPia Marsh, Alt R&B"} />
        </div>
        <div className={s.importRow}>
          <button type="button" className="button button-line" onClick={() => input.current?.click()}>
            <IconClip />
            {file ?? "Upload CSV or TXT"}
          </button>
          <input
            ref={input}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setFile(f.name);
              setText(await f.text());
              e.target.value = "";
            }}
          />
          <span className={s.found}>{acts.length ? `${acts.length} act${acts.length === 1 ? "" : "s"} found` : "Nothing to import yet"}</span>
        </div>
        {acts.length > 0 && (
          <ul className={s.preview}>
            {acts.slice(0, 8).map((a) => (
              <li key={a.name}>
                <b>{a.name}</b>
                {a.genre && <span>{a.genre}</span>}
              </li>
            ))}
            {acts.length > 8 && <li className={s.more}>and {acts.length - 8} more</li>}
          </ul>
        )}
        <footer className={d.foot}>
          <button type="button" className="button button-line" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button button-ink" disabled={!acts.length}>
            Save roster
          </button>
        </footer>
      </form>
    </dialog>
  );
}
