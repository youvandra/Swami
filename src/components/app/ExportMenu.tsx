"use client";

import { useEffect, useRef, useState } from "react";
import type { Artifact } from "@/lib/agent/types";
import { toMarkdown } from "./artifacts/export";
import { IconChevron, IconDoc, IconDownload } from "./icons";
import s from "./SaveMenu.module.css";

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Proposals export to PDF, Word or Markdown; everything else has one natural format.
export function ExportMenu({ artifact, onToast, className }: { artifact: Artifact; onToast: (m: string) => void; className: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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

  const plain = () => {
    const { name, body, type } = toMarkdown(artifact);
    save(new Blob([body], { type }), name);
    onToast(`Downloaded ${name}`);
  };

  if (artifact.type !== "proposal") {
    return (
      <button className={className} onClick={plain}>
        <IconDownload />
        <span>Export</span>
      </button>
    );
  }

  const pdf = () => {
    window.open(`/print/${artifact.id}`, "_blank", "noopener");
    onToast("Opened the print view. Choose “Save as PDF”.");
  };

  const word = async () => {
    setBusy(true);
    try {
      const { proposalDocx } = await import("@/lib/export/docx");
      const name = `${slug(artifact.title)}.docx`;
      save(await proposalDocx(artifact), name);
      onToast(`Downloaded ${name}`);
    } catch {
      onToast("Word export failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const options = [
    { label: "PDF", hint: "Print view, save as PDF", run: pdf },
    { label: "Word", hint: ".docx, keeps headings and the picks table", run: word },
    { label: "Markdown", hint: ".md, for docs and email", run: plain },
  ];

  return (
    <div className={s.root} ref={root}>
      <button className={className} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" disabled={busy}>
        <IconDownload />
        <span>{busy ? "Exporting…" : "Export"}</span>
        <IconChevron />
      </button>
      {open && (
        <div className={s.menu} role="menu">
          <p className={s.label}>Export proposal</p>
          <ul>
            {options.map((o) => (
              <li key={o.label}>
                <button
                  role="menuitem"
                  className={s.option}
                  onClick={() => {
                    setOpen(false);
                    void o.run();
                  }}
                >
                  <IconDoc />
                  <span className={s.name}>
                    {o.label}
                    <em className={s.hint}>{o.hint}</em>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
