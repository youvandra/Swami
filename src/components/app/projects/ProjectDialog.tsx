"use client";

import { useState } from "react";
import { examplesFor } from "@/lib/examples";
import type { Project } from "@/lib/model";
import { useServerStatus } from "@/lib/status";
import { Dialog } from "../ui/Dialog";
import s from "./ProjectDialog.module.css";

export type ProjectInput = Pick<Project, "name" | "kind" | "headliner" | "city" | "date" | "venue" | "capacity">;

const BLANK: ProjectInput = { name: "", kind: "show", headliner: "", city: "", date: "", venue: "", capacity: 1000 };

// One dialog for creating and editing a project.
export function ProjectDialog({ initial, title, submitLabel, onSubmit, onClose }: { initial?: ProjectInput; title: string; submitLabel: string; onSubmit: (p: ProjectInput) => void; onClose: () => void }) {
  const [form, setForm] = useState<ProjectInput>(initial ?? BLANK);
  const example = examplesFor(useServerStatus().data === "live").mid;

  const set = <K extends keyof ProjectInput>(k: K, v: ProjectInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const name = form.name.trim() || (form.headliner && form.city ? `${form.headliner} · ${form.city}${form.date ? `, ${form.date}` : ""}` : "");

  return (
    <Dialog title={title} primary={submitLabel} disabled={!name} onClose={onClose} onSubmit={() => onSubmit({ ...form, name })}>

        <div className={s.kind} role="radiogroup" aria-label="Type">
          {(["show", "tour"] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={form.kind === k} onClick={() => set("kind", k)}>
              <b>{k === "show" ? "One show" : "Tour leg"}</b>
              <span>{k === "show" ? "A single date in one city" : "Several cities in a row"}</span>
            </button>
          ))}
        </div>

        <label className={s.field}>
          <span>Headliner</span>
          <input autoFocus value={form.headliner} onChange={(e) => set("headliner", e.target.value)} placeholder={example} />
        </label>
        <div className={s.row}>
          <label className={s.field}>
            <span>{form.kind === "show" ? "City" : "Region"}</span>
            <input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder={form.kind === "show" ? "Chicago" : "Midwest"} />
          </label>
          <label className={s.field}>
            <span>{form.kind === "show" ? "Date" : "Month"}</span>
            <input value={form.date} onChange={(e) => set("date", e.target.value)} placeholder={form.kind === "show" ? "Mar 14" : "March"} />
          </label>
        </div>
        <div className={s.row}>
          <label className={s.field}>
            <span>{form.kind === "show" ? "Venue" : "Stops"}</span>
            <input value={form.venue} onChange={(e) => set("venue", e.target.value)} placeholder={form.kind === "show" ? "The Thalia Room" : "8 cities"} />
          </label>
          <label className={s.field}>
            <span>Capacity</span>
            <input type="number" min={0} step={50} value={form.capacity} onChange={(e) => set("capacity", Number(e.target.value) || 0)} />
          </label>
        </div>
        <label className={s.field}>
          <span>Project Name</span>
          <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={name || "Filled in from the headliner and city"} />
        </label>

    </Dialog>
  );
}
