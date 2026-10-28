"use client";

import { useState } from "react";
import { IconClose } from "./icons";
import s from "./ChipInput.module.css";

// A list of short values: type and press Enter or comma to add, × to remove, or pick a suggestion.
export function ChipInput({ values, onChange, placeholder, suggestions = [], label }: { values: string[]; onChange: (v: string[]) => void; placeholder: string; suggestions?: string[]; label: string }) {
  const [draft, setDraft] = useState("");
  const add = (v: string) => {
    const t = v.trim().replace(/,$/, "").trim();
    if (t && !values.some((x) => x.toLowerCase() === t.toLowerCase())) onChange([...values, t]);
    setDraft("");
  };
  const left = suggestions.filter((x) => !values.some((v) => v.toLowerCase() === x.toLowerCase())).slice(0, 6);

  return (
    <div className={s.wrap}>
      <div className={s.box}>
        {values.map((v) => (
          <span key={v} className={s.chip}>
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`}>
              <IconClose />
            </button>
          </span>
        ))}
        <input
          value={draft}
          aria-label={label}
          placeholder={values.length ? "Add another…" : placeholder}
          onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && values.length) onChange(values.slice(0, -1));
          }}
          onBlur={() => draft && add(draft)}
        />
      </div>
      {left.length > 0 && (
        <div className={s.suggest}>
          {left.map((x) => (
            <button key={x} type="button" onClick={() => add(x)}>
              + {x}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
