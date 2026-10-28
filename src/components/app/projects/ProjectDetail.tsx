"use client";

import { toast } from "@/lib/toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ArtifactType } from "@/lib/agent/types";
import { deleteProject, saveArtifact, unsaveArtifact, updateProject, useConversations, useHydrated, useProject, useSaved } from "@/lib/store";
import { useShell } from "../AppShell";
import { ArtifactPanel } from "../ArtifactPanel";
import { ARTIFACT_LABEL, artifactIcon, artifactSummary, timeAgo } from "../artifacts/meta";
import { IconCheck, IconChat, IconClose, IconDoc, IconMenu, IconPencil, IconPlus, IconRoute, IconTag, IconTrash, IconUsers } from "../icons";
import { MoreMenu } from "../MoreMenu";
import { ProjectDialog } from "./ProjectDialog";
import s from "./Projects.module.css";

type Tab = "saved" | "chats";

export function ProjectDetail({ id }: { id: string }) {
  const { openNav } = useShell();
  const router = useRouter();
  const hydrated = useHydrated();
  const project = useProject(id);
  const saved = useSaved();
  const conversations = useConversations();
  const [tab, setTab] = useState<Tab>("saved");
  const [type, setType] = useState<ArtifactType | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const setToast = (m: string | null) => m && toast(m);


  const items = useMemo(() => saved.filter((x) => x.projectId === id).sort((a, b) => b.savedAt - a.savedAt), [saved, id]);
  const chats = useMemo(() => conversations.filter((c) => c.projectId === id), [conversations, id]);
  const types = useMemo(() => [...new Set(items.map((x) => x.artifact.type))], [items]);
  const shown = type === "all" ? items : items.filter((x) => x.artifact.type === type);

  if (!hydrated) return <div className={s.page} />;
  if (!project) {
    return (
      <div className={s.page}>
        <div className={s.lost}>
          <p>This project was deleted or lives on another device.</p>
          <Link className="button button-ink" href="/app/projects">
            All projects
          </Link>
        </div>
      </div>
    );
  }

  const ask = (q: string) => router.push(`/app?project=${project.id}&q=${encodeURIComponent(q)}`);
  const where = `${project.city}${project.date ? `, ${project.date}` : ""}`;
  const quick = [
    { icon: IconUsers, label: "Find openers", q: `Find an opener for ${project.headliner} in ${where}.` },
    { icon: IconRoute, label: project.kind === "tour" ? "Route the leg" : "Pick a venue", q: project.kind === "tour" ? `Which cities should ${project.headliner} play on a ${project.city} leg in ${project.date}?` : `Which venue fits ${project.headliner} in ${project.city}?` },
    { icon: IconTag, label: "Match sponsors", q: `Find sponsors whose customers love ${project.headliner}, for the ${project.city} show.` },
    { icon: IconDoc, label: "Write a proposal", q: `Write a proposal for ${project.headliner} in ${where}, addressed to their management.` },
  ];
  const openItem = shown.find((x) => x.artifact.id === openId) ?? items.find((x) => x.artifact.id === openId);

  return (
    <div className={s.page} data-panel={openItem ? "" : undefined}>
      <div className={s.main}>
        <header className={s.bar}>
          <button className={s.iconBtn} onClick={openNav} aria-label="Open sidebar">
            <IconMenu />
          </button>
          <nav className={s.crumbs} aria-label="Breadcrumb">
            <Link href="/app/projects">Projects</Link>
            <span>/</span>
            <b>{project.name}</b>
          </nav>
          <button className={s.primary} onClick={() => router.push(`/app?project=${project.id}`)}>
            <IconPlus />
            <span>New chat</span>
          </button>
          <MoreMenu
            label="Project options"
            className={s.iconBtnShow}
            items={[
              { label: "Edit details", icon: IconPencil, onSelect: () => setEditing(true) },
              {
                label: "Delete project",
                icon: IconTrash,
                danger: true,
                onSelect: () => {
                  if (window.confirm(`Delete “${project.name}”? Its chats stay in Recent; saved results are removed from the project.`)) {
                    deleteProject(project.id);
                    router.push("/app/projects");
                  }
                },
              },
            ]}
          />
        </header>

        <div className={s.scroll}>
          <div className={s.inner}>
            <section className={s.hero}>
              <div className={s.heroTop}>
                <i className={s.swatchLg} style={{ background: project.tone }} />
                <span className={s.kindChip}>{project.kind === "show" ? "Show" : "Tour"}</span>
              </div>
              <h2 className={s.display}>{project.name}</h2>
              <dl className={s.facts}>
                <div>
                  <dt>Headliner</dt>
                  <dd>{project.headliner || "–"}</dd>
                </div>
                <div>
                  <dt>{project.kind === "show" ? "City" : "Region"}</dt>
                  <dd>{project.city || "–"}</dd>
                </div>
                <div>
                  <dt>{project.kind === "show" ? "Date" : "Month"}</dt>
                  <dd>{project.date || "–"}</dd>
                </div>
                <div>
                  <dt>{project.kind === "show" ? "Venue" : "Stops"}</dt>
                  <dd>{project.venue || "–"}</dd>
                </div>
                <div>
                  <dt>Capacity</dt>
                  <dd>{project.capacity ? project.capacity.toLocaleString("en-US") : "–"}</dd>
                </div>
              </dl>
              <div className={s.quick}>
                {quick.map((qk) => (
                  <button key={qk.label} onClick={() => ask(qk.q)}>
                    <qk.icon />
                    {qk.label}
                  </button>
                ))}
              </div>
            </section>

            <div className={s.tabs} role="tablist">
              <button role="tab" aria-selected={tab === "saved"} onClick={() => setTab("saved")}>
                Saved <em>{items.length}</em>
              </button>
              <button role="tab" aria-selected={tab === "chats"} onClick={() => setTab("chats")}>
                Chats <em>{chats.length}</em>
              </button>
            </div>

            {tab === "saved" ? (
              <>
                {types.length > 1 && (
                  <div className={s.typeFilter}>
                    <button aria-pressed={type === "all"} onClick={() => setType("all")}>
                      All
                    </button>
                    {types.map((t) => (
                      <button key={t} aria-pressed={type === t} onClick={() => setType(t)}>
                        {ARTIFACT_LABEL[t]}
                      </button>
                    ))}
                  </div>
                )}
                {items.length === 0 ? (
                  <div className={s.empty}>
                    <IconCheck />
                    <p>Nothing saved yet. Open any result in a chat and press Save.</p>
                    <button className="button button-ink" onClick={() => router.push(`/app?project=${project.id}`)}>
                      Start a chat in this project
                    </button>
                  </div>
                ) : (
                  <div className={s.savedGrid}>
                    {shown.map((x) => {
                      const Icon = artifactIcon(x.artifact.type);
                      return (
                        <article key={x.artifact.id} className={s.savedCard} data-open={openId === x.artifact.id || undefined}>
                          <button className={s.savedOpen} onClick={() => setOpenId(x.artifact.id)}>
                            <span className={s.savedIcon}>
                              <Icon weight="duotone" />
                            </span>
                            <span className={s.savedType}>{ARTIFACT_LABEL[x.artifact.type]}</span>
                            <b className={s.savedTitle}>{x.artifact.title}</b>
                            <span className={s.savedSummary}>{artifactSummary(x.artifact)}</span>
                            <span className={s.savedTime}>Saved {timeAgo(x.savedAt)}</span>
                          </button>
                          <button
                            className={s.savedRemove}
                            aria-label={`Remove ${x.artifact.title}`}
                            data-tip="Remove from project"
                            data-tip-pos="end"
                            onClick={() => {
                              unsaveArtifact(project.id, x.artifact.id);
                              if (openId === x.artifact.id) setOpenId(null);
                              toast("Removed from project", { label: "Undo", run: () => saveArtifact(project.id, x.artifact, x.conversationId) });
                            }}
                          >
                            <IconClose />
                          </button>
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            ) : chats.length === 0 ? (
              <div className={s.empty}>
                <IconChat />
                <p>No chats in this project yet.</p>
                <button className="button button-ink" onClick={() => router.push(`/app?project=${project.id}`)}>
                  Start a chat
                </button>
              </div>
            ) : (
              <ul className={s.chatList}>
                {chats.map((c) => {
                  const last = [...c.messages].reverse().find((m) => m.role === "assistant");
                  const n = c.messages.flatMap((m) => m.artifacts ?? []).length;
                  return (
                    <li key={c.id}>
                      <Link href={`/app/c/${c.id}`} className={s.chatRow}>
                        <IconChat className={s.chatIcon} />
                        <span className={s.chatText}>
                          <b>{c.title}</b>
                          <span>{last?.text ?? c.messages[0]?.text}</span>
                        </span>
                        <span className={s.chatMeta}>
                          <span>{n} result{n === 1 ? "" : "s"}</span>
                          <span>{timeAgo(c.updatedAt)}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}

          </div>
        </div>
      </div>

      {openItem && (
        <ArtifactPanel
          artifacts={items.map((x) => x.artifact)}
          activeId={openItem.artifact.id}
          onSelect={setOpenId}
          onClose={() => setOpenId(null)}
          onAsk={ask}
          onToast={setToast}
          conversationId={openItem.conversationId}
          defaultProjectId={project.id}
        />
      )}

      {editing && (
        <ProjectDialog
          title="Edit project"
          submitLabel="Save changes"
          initial={project}
          onClose={() => setEditing(false)}
          onSubmit={(input) => {
            updateProject(project.id, input);
            setEditing(false);
            setToast("Project updated");
          }}
        />
      )}
    </div>
  );
}
