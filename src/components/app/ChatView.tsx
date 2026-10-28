"use client";

import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AgentEvent } from "@/lib/agent/events";
import type { Artifact, Choice, Conversation, Message, Mode, Step } from "@/lib/agent/types";
import { readEvents } from "@/lib/sse";
import { useServerStatus } from "@/lib/status";
import { ROLES } from "@/lib/model";
import { deleteConversation, newId, saveConversation, setConversationProject, useCanEdit, useConversation, useProjects, useRosters, useWorkspace } from "@/lib/store";
import { Logo } from "../landing/Logo";
import { ArtifactPanel, artifactIcon } from "./ArtifactPanel";
import { useShell } from "./AppShell";
import { Composer, type AttachedRoster } from "./Composer";
import { IconArrowRight, IconChart, IconCheck, IconChevron, IconDoc, IconFolder, IconMenu, IconPanel, IconPencil, IconRoute, IconStore, IconTag, IconTrash, IconUsers, IconWarn } from "./icons";
import { MoreMenu } from "./MoreMenu";
import s from "./ChatView.module.css";

// The show and opener of the chat's latest result, so "now find venues" needs no names.
function lastShow(messages: Message[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const arts = messages[i].artifacts ?? [];
    if (!arts.length) continue;
    const { headliner, city, date } = arts[0].show;
    const withOpener = arts.find((a) => a.type === "crowd_map" || a.type === "audience");
    const ranking = arts.find((a) => a.type === "opener_ranking");
    const opener = withOpener && "opener" in withOpener ? withOpener.opener : ranking?.type === "opener_ranking" ? ranking.rows[0]?.name : undefined;
    return { headliner, city, date, opener };
  }
  return undefined;
}

// An error whose message is written for the person reading the chat.
class ShownError extends Error {}

// Quick tasks start from the workspace's own artists and cities.
const tasksFor = (artist: string, city: string) => [
  { icon: IconUsers, title: "Find an opener", hint: "Ranked by the crowd each act adds", prompt: `Find an opener for ${artist} in ${city}, Mar 14. Roster only.` },
  { icon: IconRoute, title: "Route a tour", hint: "Cities ranked by fan demand", prompt: `Which cities should ${artist} play on a Midwest leg in March?` },
  { icon: IconTag, title: "Match sponsors", hint: "Brands your fans already buy", prompt: `Find sponsors whose customers love ${artist}, for the ${city} show.` },
  { icon: IconStore, title: "Plan the local push", hint: "Bars and shops that share your crowd", prompt: `Find co-promo partners in ${city} for ${artist} and the top opener.` },
  { icon: IconChart, title: "Know the audience", hint: "Age, gender and taste, side by side", prompt: `Who is the audience for ${artist} in ${city}, next to the top opener? Age and gender.` },
  { icon: IconDoc, title: "Write a proposal", hint: "A draft you can edit and export", prompt: `Write a proposal for ${artist} in ${city}, Mar 14, addressed to their management.` },
];

export function ChatView({ id: routeId }: { id: string | null }) {
  const { openNav } = useShell();
  const router = useRouter();
  const [id, setId] = useState(routeId);
  const stored = useConversation(id);
  const [mode, setMode] = useState<Mode>("auto");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Message | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const setToast = (m: string | null) => m && toast(m);
  const [hydrated, setHydrated] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const stopRef = useRef<AbortController | null>(null);
  const dataMode = useServerStatus().data;
  const canEdit = useCanEdit();
  const projects = useProjects();
  const workspace = useWorkspace();
  const rosters = useRosters();
  const tasks = tasksFor(workspace.artists[0] ?? "Marlow Vane", workspace.cities[0] ?? "Chicago");
  // a new chat can start inside a project (/app?project=…) and with a first question (&q=…)
  const [draftProject, setDraftProject] = useState<string | undefined>(undefined);
  const projectId = stored?.projectId ?? draftProject;
  const project = projects.find((p) => p.id === projectId);

  useEffect(() => setHydrated(true), []);

  const started = useRef(false);
  useEffect(() => {
    if (routeId || started.current) return;
    started.current = true;
    const q = new URLSearchParams(window.location.search);
    const pid = q.get("project") ?? undefined;
    if (pid) setDraftProject(pid);
    const ask = q.get("q");
    if (ask) void send(ask, pid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  const messages = useMemo(() => [...(stored?.messages ?? []), ...(pending ? [pending] : [])], [stored, pending]);
  const artifacts = useMemo(() => messages.flatMap((m) => m.artifacts ?? []), [messages]);

  // open the newest artifact when a conversation is first shown on a wide screen
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || artifacts.length === 0) return;
    opened.current = true;
    setActiveId(artifacts[0].id);
    setPanelOpen(window.matchMedia("(min-width: 1180px)").matches);
  }, [artifacts]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length, busy]);


  async function send(text: string, startProject = projectId, attached?: AttachedRoster, extraEntities: Record<string, string> = {}) {
    const chatProject = projects.find((p) => p.id === startProject);
    if (busy) return;
    // "roster only" with nothing attached means the workspace's newest roster
    const saved = !attached && /\broster\b/i.test(text) ? rosters[0] : undefined;
    const roster = attached ?? (saved && { name: saved.name, acts: saved.acts.map((a) => a.name) });
    const convId = id ?? newId();
    const shown = roster ? `${text}\n\nRoster: ${roster.name} (${roster.acts.length} acts)` : text;
    const user: Message = { id: newId(), role: "user", text: shown, createdAt: Date.now() };
    const base: Conversation = stored ?? { id: convId, title: text.slice(0, 48), mode, projectId: startProject, updatedAt: Date.now(), messages: [] };
    const withUser = { ...base, mode, updatedAt: Date.now(), messages: [...base.messages, user] };
    opened.current = true; // the reply opens its own artifact below
    saveConversation(withUser);
    if (!id) {
      setId(convId);
      window.history.replaceState(null, "", `/app/c/${convId}`);
    }

    setBusy(true);
    const live: Message = { id: "pending", role: "assistant", text: "", createdAt: Date.now(), steps: [], artifacts: [] };
    const keyed = new Map<string, Step>();
    const show = () => setPending({ ...live, steps: [...keyed.values()], artifacts: [...(live.artifacts ?? [])] });
    show();
    const abort = new AbortController();
    stopRef.current = abort;
    const entities = { ...(base.entities ?? {}), ...extraEntities };
    const finish = (message: Message, patch: Partial<Conversation> = {}) =>
      saveConversation({ ...withUser, entities, ...patch, updatedAt: Date.now(), messages: [...withUser.messages, message] });
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "text/event-stream" },
        signal: abort.signal,
        body: JSON.stringify({
          conversationId: convId,
          mode,
          messages: withUser.messages.slice(-24).map(({ role, text }) => ({ role, text })),
          context: {
            workspace: workspace.name,
            role: ROLES.find((r) => r.id === workspace.role)?.label ?? workspace.role,
            cities: workspace.cities,
            artists: workspace.artists,
            roster: roster && { name: roster.name, acts: roster.acts },
            project: chatProject && { headliner: chatProject.headliner, city: chatProject.city, date: chatProject.date, venue: chatProject.venue, capacity: chatProject.capacity },
            entities,
            last: lastShow(withUser.messages),
          },
        }),
      });
      if (!res.ok || !res.body) {
        const said = (await res.json().catch(() => null))?.error;
        throw said ? new ShownError(said) : new Error(`HTTP ${res.status}`);
      }
      let done = false;
      for await (const e of readEvents<AgentEvent>(res.body)) {
        if (e.type === "step") keyed.set(e.step.key, e.step);
        else if (e.type === "text") live.text += (live.text ? " " : "") + e.delta;
        else if (e.type === "choices") live.choices = e.choices;
        else if (e.type === "artifact") {
          live.artifacts = [...(live.artifacts ?? []), e.artifact];
          if (live.artifacts.length === 1) {
            setActiveId(e.artifact.id);
            setPanelOpen(true);
          }
        } else if (e.type === "done") {
          done = true;
          setPending(null); // the stored message replaces the live one in the same render
          finish(e.message, { entities: e.entities, title: base.messages.length ? withUser.title : e.title });
          const first = e.message.artifacts?.[0];
          if (first) setActiveId((cur) => cur ?? first.id);
        } else if (e.type === "error") throw new ShownError(e.message);
        if (!done) show();
      }
      if (!done) throw new Error("The reply was cut off.");
    } catch (err) {
      const stopped = abort.signal.aborted;
      const kept: Message = {
        id: newId(),
        role: "assistant",
        createdAt: Date.now(),
        // keep what arrived; say plainly what happened to the rest
        text: [live.text, stopped ? "Stopped." : err instanceof ShownError ? err.message : "Swami could not finish this reply. Your message is saved; send it again in a moment."].filter(Boolean).join(" "),
        steps: [...keyed.values()].map((st) => (st.status === "running" ? { ...st, status: "failed" as const, detail: stopped ? "stopped" : st.detail } : st)),
        artifacts: live.artifacts,
      };
      if (!stopped) console.warn(err);
      setPending(null);
      finish(kept);
    } finally {
      stopRef.current = null;
      setPending(null);
      setBusy(false);
    }
  }

  function choose(c: Choice, key: string) {
    void send(c.reply, projectId, undefined, { [key]: c.id, [c.name.toLowerCase()]: c.id });
  }

  const missing = hydrated && routeId && !stored && id === routeId;
  const empty = messages.length === 0;

  return (
    <div className={s.view} data-panel={panelOpen && artifacts.length > 0 ? "" : undefined}>
      <section className={s.chat}>
        <header className={s.header}>
          <button className={s.iconBtn} onClick={openNav} aria-label="Open sidebar" data-tip="Menu">
            <IconMenu />
          </button>
          <div className={s.titleWrap}>
            {renaming && stored ? (
              <input
                className={s.rename}
                autoFocus
                defaultValue={stored.title}
                aria-label="Chat name"
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setRenaming(false);
                }}
                onBlur={(e) => {
                  const title = e.currentTarget.value.trim();
                  if (title && title !== stored.title) saveConversation({ ...stored, title });
                  setRenaming(false);
                }}
              />
            ) : (
              <h1 className={s.title} onDoubleClick={() => stored && setRenaming(true)}>
                {empty ? "New chat" : (stored?.title ?? "New chat")}
              </h1>
            )}
            {hydrated && projects.length > 0 && (
              <label className={s.project} data-set={project ? "" : undefined}>
                {project ? <i style={{ background: project.tone }} /> : <IconFolder />}
                <span>{project?.name ?? "Add to project"}</span>
                <IconChevron />
                <select
                  value={projectId ?? ""}
                  aria-label="Project"
                  onChange={(e) => {
                    const v = e.target.value || undefined;
                    if (stored) setConversationProject(stored.id, v);
                    else setDraftProject(v);
                  }}
                >
                  <option value="">No project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className={s.actions}>
            {artifacts.length > 0 && (
              <button
                className={s.iconBtn}
                onClick={() => setPanelOpen((o) => !o)}
                aria-label={panelOpen ? "Hide results" : "Show results"}
                aria-pressed={panelOpen}
                data-tip={panelOpen ? "Hide results" : "Show results"}
              >
                <IconPanel />
              </button>
            )}
            {stored && (
              <MoreMenu
                label="Chat options"
                className={s.iconBtn}
                items={[
                  { label: "Rename", icon: IconPencil, onSelect: () => setRenaming(true) },
                  {
                    label: "Delete chat",
                    icon: IconTrash,
                    danger: true,
                    onSelect: () => {
                      const gone = stored;
                      deleteConversation(gone.id);
                      router.push("/app");
                      toast(`Deleted “${gone.title}”`, { label: "Undo", run: () => saveConversation(gone) });
                    },
                  },
                ]}
              />
            )}
          </div>
        </header>

        {missing ? (
          <div className={s.center}>
            <p className={s.lost}>This chat lives on another device or was cleared.</p>
            <a className="button button-ink" href="/app">
              Start a new chat
            </a>
          </div>
        ) : empty ? (
          <div className={s.center}>
            <div className={s.hello}>
              <Logo className={s.helloLogo} />
              <h2 className={s.greet}>{project ? `What's next for ${project.name}?` : "What are we booking today?"}</h2>
              <p className={s.sub}>Ask about any show or tour. Swami answers with rankings, maps and drafts you can edit and send.</p>
            </div>
            <div className={s.composerWrap}>
              <Composer onSend={(q, r) => send(q, projectId, r)} mode={mode} onMode={setMode} busy={busy} onStop={() => stopRef.current?.abort()} readOnly={!canEdit} autoFocus />
            </div>
            <div className={s.tasks}>
              {tasks.map((t) => (
                <button key={t.title} className={s.task} onClick={() => send(t.prompt)}>
                  <t.icon className={s.taskIcon} weight="duotone" />
                  <span className={s.taskTitle}>{t.title}</span>
                  <span className={s.taskPrompt}>{t.hint}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className={s.thread}>
              <div className={s.messages}>
                {messages.map((m) =>
                  m.role === "user" ? (
                    <div key={m.id} className={s.user}>
                      <p>{m.text}</p>
                    </div>
                  ) : (
                    <AssistantMessage
                      key={m.id}
                      message={m}
                      activeId={panelOpen ? activeId : null}
                      onChoose={busy || m !== messages[messages.length - 1] ? undefined : choose}
                      onOpen={(a) => {
                        setActiveId(a.id);
                        setPanelOpen(true);
                      }}
                    />
                  ),
                )}
                <div ref={end} />
              </div>
            </div>
            <div className={s.dock}>
              <Composer onSend={(q, r) => send(q, projectId, r)} mode={mode} onMode={setMode} busy={busy} onStop={() => stopRef.current?.abort()} readOnly={!canEdit} placeholder="Reply to Swami…" />
              <p className={s.disclaimer}>{dataMode === "fixture" ? "Demo data · " : ""}Review drafts before you send them</p>
            </div>
          </>
        )}
      </section>

      {artifacts.length > 0 && panelOpen && (
        <ArtifactPanel
          artifacts={artifacts}
          activeId={activeId ?? artifacts[0].id}
          onSelect={setActiveId}
          onClose={() => setPanelOpen(false)}
          onAsk={(q) => send(q)}
          onToast={setToast}
          conversationId={id ?? undefined}
          defaultProjectId={projectId}
        />
      )}
    </div>
  );
}

function AssistantMessage({ message, activeId, onOpen, onChoose }: { message: Message; activeId: string | null; onOpen: (a: Artifact) => void; onChoose?: (c: Choice, key: string) => void }) {
  const streaming = message.id === "pending";
  const steps = message.steps ?? [];
  const total = steps.reduce((n, st) => n + st.ms, 0);
  const failed = steps.filter((st) => st.status === "failed").length;
  return (
    <div className={s.assistant}>
      <Logo className={s.avatar} />
      <div className={s.body}>
        {streaming && steps.length === 0 ? (
          <p className={s.thinking}>
            <span className={s.pulse} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            Reading the taste graph…
          </p>
        ) : (
          <>
            {streaming ? (
              <ol className={s.liveSteps} aria-live="polite">
                {steps.map((st, i) => (
                  <li key={i} data-status={st.status}>
                    {st.status === "running" ? <span className={s.spin} aria-hidden="true" /> : st.status === "failed" ? <IconWarn className={s.stepFail} /> : <IconCheck className={s.stepDone} />}
                    <b>{st.label}</b>
                    {st.detail && <span>{st.detail}</span>}
                    {st.status !== "running" && <em>{(st.ms / 1000).toFixed(1)}s</em>}
                  </li>
                ))}
              </ol>
            ) : (
              steps.length > 0 && (
                <details className={s.steps}>
                  <summary>
                    {failed ? <IconWarn className={s.stepsIcon} /> : <IconCheck className={s.stepsIcon} />}
                    Worked for {total < 100 ? "under 0.1s" : `${(total / 1000).toFixed(1)}s`}<span className={s.stepsCount}>{steps.length} step{steps.length === 1 ? "" : "s"}{failed ? ` · ${failed} failed` : ""}</span>
                    <IconChevron className={s.stepsChevron} />
                  </summary>
                  <ol>
                    {steps.map((st, i) => (
                      <li key={i} data-status={st.status}>
                        <b>{st.label}</b>
                        {st.detail && <span>{st.detail}</span>}
                        <em>{(st.ms / 1000).toFixed(1)}s</em>
                      </li>
                    ))}
                  </ol>
                </details>
              )
            )}
            {message.text && <p className={s.text}>{message.text}</p>}
            {message.choices && (
              <div className={s.choices} role="group" aria-label={message.choices.prompt}>
                {message.choices.options.map((c) => (
                  <button key={c.id} className={s.choice} disabled={!onChoose} onClick={() => onChoose?.(c, message.choices!.key)}>
                    {c.image ? <img src={c.image} alt="" className={s.choiceImg} /> : <span className={s.choiceImg}>{c.name.slice(0, 1)}</span>}
                    <span className={s.choiceText}>
                      <b>{c.name}</b>
                      <span>{c.detail}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {message.artifacts && message.artifacts.length > 0 && (
              <div className={s.chips}>
                {message.artifacts.map((a) => {
                  const Icon = artifactIcon(a.type);
                  return (
                    <button key={a.id} className={s.chip} data-active={activeId === a.id || undefined} onClick={() => onOpen(a)}>
                      <span className={s.chipIcon}>
                        <Icon weight="duotone" />
                      </span>
                      <span className={s.chipText}>
                        <b>{a.title}</b>
                        <span>{a.subtitle}</span>
                      </span>
                      <span className={s.chipOpen} aria-hidden="true">
                        <IconArrowRight />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
