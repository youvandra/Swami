"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createProject, useConversations, useHydrated, useProjects, useSaved } from "@/lib/store";
import { useShell } from "../AppShell";
import { artifactIcon, timeAgo } from "../artifacts/meta";
import { IconFolder, IconMenu, IconPlus } from "../icons";
import { ProjectDialog } from "./ProjectDialog";
import s from "./Projects.module.css";

type Filter = "all" | "show" | "tour";

export function ProjectsIndex() {
  const { openNav } = useShell();
  const router = useRouter();
  const hydrated = useHydrated();
  const projects = useProjects();
  const saved = useSaved();
  const conversations = useConversations();
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, setCreating] = useState(false);

  // the sidebar's + button lands here with ?new=1
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      setCreating(true);
      window.history.replaceState(null, "", "/app/projects");
    }
  }, []);

  const rows = useMemo(
    () =>
      projects
        .filter((p) => filter === "all" || p.kind === filter)
        .map((p) => {
          const items = saved.filter((x) => x.projectId === p.id);
          return { p, items, chats: conversations.filter((c) => c.projectId === p.id).length };
        }),
    [projects, saved, conversations, filter],
  );

  return (
    <div className={s.page}>
      <div className={s.main}>
        <header className={s.bar}>
          <button className={s.iconBtn} onClick={openNav} aria-label="Open sidebar">
            <IconMenu />
          </button>
          <h1 className={s.barTitle}>Projects</h1>
          <button className={s.primary} onClick={() => setCreating(true)}>
            <IconPlus />
            <span>New Project</span>
          </button>
        </header>

        <div className={s.scroll}>
          <div className={s.inner}>
            <div className={s.intro}>
              <h2 className={s.display}>Every show and tour, in one place.</h2>
              <p>Save rankings, maps, proposals and drafts to a project. Chats started inside a project stay with it.</p>
            </div>

            <div className={s.toolbar}>
              <div className={s.seg} role="radiogroup" aria-label="Filter">
                {(
                  [
                    ["all", "All"],
                    ["show", "Shows"],
                    ["tour", "Tours"],
                  ] as const
                ).map(([id, label]) => (
                  <button key={id} role="radio" aria-checked={filter === id} onClick={() => setFilter(id)}>
                    {label}
                  </button>
                ))}
              </div>
              <span className={s.count}>{hydrated ? `${rows.length} project${rows.length === 1 ? "" : "s"}` : ""}</span>
            </div>

            {hydrated && rows.length === 0 && (
              <div className={s.empty}>
                <IconFolder />
                <p>No projects here yet.</p>
                <button className="button button-ink" onClick={() => setCreating(true)}>
                  Create a Project
                </button>
              </div>
            )}

            <div className={s.grid}>
              {rows.map(({ p, items, chats }) => (
                <Link key={p.id} href={`/app/projects/${p.id}`} className={s.card}>
                  <div className={s.cardTop}>
                    <i className={s.swatch} style={{ background: p.tone }} />
                    <span className={s.kindChip}>{p.kind === "show" ? "Show" : "Tour"}</span>
                    <span className={s.updated}>{timeAgo(p.updatedAt)}</span>
                  </div>
                  <h3 className={s.cardName}>{p.name}</h3>
                  <p className={s.cardMeta}>{[p.headliner, p.city, p.date, p.venue].filter(Boolean).join(" · ")}</p>
                  <div className={s.cardFoot}>
                    <span className={s.icons} aria-hidden="true">
                      {items.slice(0, 5).map((x) => {
                        const Icon = artifactIcon(x.artifact.type);
                        return (
                          <span key={x.artifact.id}>
                            <Icon />
                          </span>
                        );
                      })}
                    </span>
                    <span>
                      {items.length} saved · {chats} chat{chats === 1 ? "" : "s"}
                    </span>
                  </div>
                </Link>
              ))}
              {hydrated && rows.length > 0 && (
                <button className={s.addCard} onClick={() => setCreating(true)}>
                  <IconPlus />
                  New Project
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {creating && (
        <ProjectDialog
          title="New Project"
          submitLabel="Create project"
          onClose={() => setCreating(false)}
          onSubmit={(input) => {
            const p = createProject(input);
            setCreating(false);
            router.push(`/app/projects/${p.id}`);
          }}
        />
      )}
    </div>
  );
}
