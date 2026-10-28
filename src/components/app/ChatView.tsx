"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Artifact, ChatResponse, Conversation, Message, Mode } from "@/lib/agent/types";
import { newId, saveConversation, useConversation } from "@/lib/store";
import { Logo } from "../landing/Logo";
import { ArtifactPanel, artifactIcon } from "./ArtifactPanel";
import { useShell } from "./AppShell";
import { Composer } from "./Composer";
import { IconCheck, IconChevron, IconDoc, IconMenu, IconPanel, IconRoute, IconShare, IconStore, IconTag, IconUsers } from "./icons";
import s from "./ChatView.module.css";

const TASKS = [
  { icon: IconUsers, title: "Find an opener", prompt: "Find an opener for Marlow Vane in Chicago, Mar 14. Roster only." },
  { icon: IconRoute, title: "Route a tour leg", prompt: "Which cities should Marlow Vane play on a Midwest leg in March?" },
  { icon: IconTag, title: "Match sponsors", prompt: "Find sponsors whose customers love Marlow Vane, for the Chicago show." },
  { icon: IconStore, title: "Plan the local push", prompt: "Find co-promo partners in Chicago for Marlow Vane with Halcyon Drive." },
  { icon: IconUsers, title: "Know the audience", prompt: "Who is the audience for Marlow Vane and Halcyon Drive in Chicago? Age and gender." },
  { icon: IconDoc, title: "Write a proposal", prompt: "Write a proposal to Marlow Vane management for the Chicago opener." },
];

export function ChatView({ id: routeId }: { id: string | null }) {
  const { openNav } = useShell();
  const [id, setId] = useState(routeId);
  const stored = useConversation(id);
  const [mode, setMode] = useState<Mode>("auto");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Message | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => setHydrated(true), []);

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

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  async function send(text: string) {
    if (busy) return;
    const convId = id ?? newId();
    const user: Message = { id: newId(), role: "user", text, createdAt: Date.now() };
    const base: Conversation = stored ?? { id: convId, title: text.slice(0, 48), mode, updatedAt: Date.now(), messages: [] };
    const withUser = { ...base, mode, updatedAt: Date.now(), messages: [...base.messages, user] };
    opened.current = true; // the reply opens its own artifact below
    saveConversation(withUser);
    if (!id) {
      setId(convId);
      window.history.replaceState(null, "", `/app/c/${convId}`);
    }

    setBusy(true);
    setPending({ id: "pending", role: "assistant", text: "", createdAt: Date.now() });
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: convId, mode, messages: withUser.messages.map(({ role, text }) => ({ role, text })) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ChatResponse;
      saveConversation({
        ...withUser,
        title: base.messages.length ? withUser.title : data.title,
        updatedAt: Date.now(),
        messages: [...withUser.messages, data.message],
      });
      const first = data.message.artifacts?.[0];
      if (first) {
        setActiveId(first.id);
        setPanelOpen(true);
      }
    } catch {
      saveConversation({
        ...withUser,
        messages: [...withUser.messages, { id: newId(), role: "assistant", text: "Swami could not reach the server. Your message is saved; send it again in a moment.", createdAt: Date.now() }],
      });
    } finally {
      setPending(null);
      setBusy(false);
    }
  }

  const missing = hydrated && routeId && !stored && id === routeId;
  const empty = messages.length === 0;

  return (
    <div className={s.view} data-panel={panelOpen && artifacts.length > 0 ? "" : undefined}>
      <section className={s.chat}>
        <header className={s.header}>
          <button className={s.iconBtn} onClick={openNav} aria-label="Open sidebar">
            <IconMenu />
          </button>
          <div className={s.titleWrap}>
            <h1 className={s.title}>{empty ? "New chat" : (stored?.title ?? "New chat")}</h1>
            {stored?.project && <span className={s.project}>{stored.project}</span>}
          </div>
          <div className={s.actions}>
            {!empty && (
              <button className={s.ghost} onClick={() => setToast("Share links arrive with team workspaces")}>
                <IconShare />
                <span>Share</span>
              </button>
            )}
            {artifacts.length > 0 && (
              <button className={s.iconBtn} onClick={() => setPanelOpen((o) => !o)} aria-label={panelOpen ? "Hide results" : "Show results"} aria-pressed={panelOpen}>
                <IconPanel />
              </button>
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
              <h2 className={s.greet}>What are we booking today?</h2>
              <p className={s.sub}>Openers, routing, venues, sponsors, proposals. Every answer comes with data you can check, edit and send.</p>
            </div>
            <div className={s.composerWrap}>
              <Composer onSend={send} mode={mode} onMode={setMode} busy={busy} autoFocus />
            </div>
            <div className={s.tasks}>
              {TASKS.map((t) => (
                <button key={t.title} className={s.task} onClick={() => send(t.prompt)}>
                  <t.icon className={s.taskIcon} />
                  <span className={s.taskTitle}>{t.title}</span>
                  <span className={s.taskPrompt}>{t.prompt}</span>
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
              <Composer onSend={send} mode={mode} onMode={setMode} busy={busy} placeholder="Ask a follow-up…" />
              <p className={s.disclaimer}>Scores show audience affinity. Check names and terms before you send anything.</p>
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
          onAsk={send}
          onToast={setToast}
        />
      )}

      {toast && (
        <div className={s.toast} role="status">
          <IconCheck />
          {toast}
        </div>
      )}
    </div>
  );
}

function AssistantMessage({ message, activeId, onOpen }: { message: Message; activeId: string | null; onOpen: (a: Artifact) => void }) {
  const thinking = message.id === "pending";
  const total = (message.steps ?? []).reduce((n, st) => n + st.ms, 0);
  return (
    <div className={s.assistant}>
      <Logo className={s.avatar} />
      <div className={s.body}>
        {thinking ? (
          <p className={s.thinking}>
            <span className={s.pulse} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            Searching the taste graph…
          </p>
        ) : (
          <>
            {message.steps && message.steps.length > 0 && (
              <details className={s.steps}>
                <summary>
                  <IconCheck className={s.stepsIcon} />
                  {message.steps.length} steps · {(total / 1000).toFixed(1)}s
                  <IconChevron className={s.stepsChevron} />
                </summary>
                <ol>
                  {message.steps.map((st) => (
                    <li key={st.label}>
                      <b>{st.label}</b>
                      {st.detail && <span>{st.detail}</span>}
                    </li>
                  ))}
                </ol>
              </details>
            )}
            <p className={s.text}>{message.text}</p>
            {message.artifacts && message.artifacts.length > 0 && (
              <div className={s.chips}>
                {message.artifacts.map((a) => {
                  const Icon = artifactIcon(a.type);
                  return (
                    <button key={a.id} className={s.chip} data-active={activeId === a.id || undefined} onClick={() => onOpen(a)}>
                      <span className={s.chipIcon}>
                        <Icon />
                      </span>
                      <span className={s.chipText}>
                        <b>{a.title}</b>
                        <span>{a.subtitle}</span>
                      </span>
                      <span className={s.chipOpen}>Open</span>
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
