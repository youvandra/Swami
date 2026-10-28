"use client";

import { useEffect, useRef, useState } from "react";
import type { Artifact } from "@/lib/agent/types";
import { createProject, saveArtifact, unsaveArtifact, useProjects, useSaved } from "@/lib/store";
import { IconBookmark, IconCheck, IconPlus } from "./icons";
import s from "./SaveMenu.module.css";

type Props = { artifact: Artifact; conversationId?: string; defaultProjectId?: string; onToast: (m: string) => void };

export function SaveMenu({ artifact, conversationId, defaultProjectId, onToast }: Props) {
  const projects = useProjects();
  const saved = useSaved();
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const root = useRef<HTMLDivElement>(null);

  const savedIn = new Set(saved.filter((x) => x.artifact.id === artifact.id).map((x) => x.projectId));
  const isSaved = savedIn.size > 0;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const toggle = (projectId: string, projectName: string) => {
    if (savedIn.has(projectId)) {
      unsaveArtifact(projectId, artifact.id);
      onToast(`Removed from ${projectName}`);
    } else {
      saveArtifact(projectId, artifact, conversationId);
      onToast(`Saved to ${projectName}`);
    }
  };

  const create = () => {
    const n = name.trim();
    if (!n) return;
    const { show } = artifact;
    const p = createProject({ name: n, kind: "show", headliner: show.headliner, city: show.city, date: show.date, venue: show.venue, capacity: show.capacity });
    saveArtifact(p.id, artifact, conversationId);
    onToast(`Saved to ${p.name}`);
    setName("");
    setNaming(false);
    setOpen(false);
  };

  // put the chat's own project first
  const ordered = [...projects].sort((a, b) => Number(b.id === defaultProjectId) - Number(a.id === defaultProjectId));

  return (
    <div className={s.root} ref={root}>
      <button className={s.trigger} data-saved={isSaved || undefined} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        {isSaved ? <IconCheck /> : <IconBookmark />}
        <span>{isSaved ? "Saved" : "Save"}</span>
      </button>
      {open && (
        <div className={s.menu} role="menu">
          <p className={s.label}>Save to project</p>
          <ul>
            {ordered.map((p) => (
              <li key={p.id}>
                <button role="menuitemcheckbox" aria-checked={savedIn.has(p.id)} onClick={() => toggle(p.id, p.name)}>
                  <i className={s.swatch} style={{ background: p.tone }} />
                  <span className={s.name}>{p.name}</span>
                  {p.id === defaultProjectId && <em>This chat</em>}
                  <span className={s.check}>{savedIn.has(p.id) && <IconCheck />}</span>
                </button>
              </li>
            ))}
          </ul>
          {naming ? (
            <form
              className={s.create}
              onSubmit={(e) => {
                e.preventDefault();
                create();
              }}
            >
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" aria-label="Project name" />
              <button type="submit" disabled={!name.trim()}>
                Create
              </button>
            </form>
          ) : (
            <button className={s.new} onClick={() => setNaming(true)}>
              <IconPlus />
              New project
            </button>
          )}
        </div>
      )}
    </div>
  );
}
