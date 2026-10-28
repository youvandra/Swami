"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { ROSTER_MAX_BYTES, parseRoster } from "@/lib/roster";
import { saveRoster } from "@/lib/store";
import type { Roster } from "@/lib/model";
import { IconClip } from "../icons";
import { Dialog } from "../ui/Dialog";
import d from "../projects/ProjectDialog.module.css";
import s from "./Settings.module.css";

// Import a roster from pasted text or a CSV/TXT file, with a live preview of what was understood.
export function RosterDialog({ onClose, onSaved }: { onClose: () => void; onSaved: (r: Roster) => void }) {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const acts = useMemo(() => parseRoster(text), [text]);

  return (
    <Dialog title="Import a roster" primary="Save roster" disabled={!acts.length} onClose={onClose} onSubmit={() => onSaved(saveRoster(name.trim() || file?.replace(/\.\w+$/, "") || "New roster", acts))}>
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
              if (f.size > ROSTER_MAX_BYTES) toast(`${f.name} is over 200 KB; Swami reads the first 500 acts`);
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
    </Dialog>
  );
}
