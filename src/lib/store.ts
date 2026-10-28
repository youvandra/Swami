"use client";

// Components read through the use* hooks and write through the actions below. With accounts on, the server
// holds the workspace: hooks read a cache filled by /api/bootstrap and every action is also sent to
// /api/sync. Without accounts, the workspace lives in this browser's localStorage.

import { useSyncExternalStore } from "react";
import type { Artifact, Conversation, Message } from "./agent/types";
import demo from "./demo-seed.json";
import { accountsOn } from "./db/config";
import type { Op } from "./db/sync";
import { toast } from "./toast";
import { TONES, type Member, type Project, type Roster, type SavedArtifact, type Workspace } from "./model";

type State = {
  conversations: Conversation[];
  projects: Project[];
  saved: SavedArtifact[];
  workspace: Workspace;
  team: Member[];
  rosters: Roster[];
  /** Accounts on: every workspace the user belongs to, and the one open. */
  memberships?: { id: string; name: string; role: Member["role"] }[];
  current?: string;
};

const KEY = "swami.state.v2";
const LEGACY_KEY = "swami.conversations.v1";
const DEFAULT_WORKSPACE: Workspace = { name: "Northside Live", role: "promoter", cities: ["Chicago"], artists: ["Marlow Vane"], plan: "season", onboarded: false };
const DEFAULT_TEAM: Member[] = [
  { id: "m-you", name: "You", email: "you@northsidelive.example", role: "Owner", status: "active" },
  { id: "m-ana", name: "Ana Ruiz", email: "ana@northsidelive.example", role: "Editor", status: "active" },
  { id: "m-dev", name: "Dev Patel", email: "dev@northsidelive.example", role: "Editor", status: "active" },
  { id: "m-kim", name: "Kim Osei", email: "kim@northsidelive.example", role: "Viewer", status: "invited" },
];
const DEFAULT_ROSTERS: Roster[] = [
  {
    id: "r-northlight",
    name: "Northlight Agency · spring",
    createdAt: Date.UTC(2026, 9, 20),
    acts: [
      { name: "Halcyon Drive", genre: "Indie rock" },
      { name: "The Low Orchard", genre: "Folk pop" },
      { name: "Copper Hours", genre: "Garage" },
      { name: "Fieldwork", genre: "Post-punk" },
      { name: "Glass Meridian", genre: "Synth pop" },
    ],
  },
];
const EMPTY: State = { conversations: [], projects: [], saved: [], workspace: DEFAULT_WORKSPACE, team: [], rosters: [] };
let cache: State | null = null;
const listeners = new Set<() => void>();

export const newId = () => Math.random().toString(36).slice(2, 10);

function seed(): State {
  const now = Date.now();
  const min = 60_000;
  const projects: Project[] = [
    { id: "p-chicago", name: "Marlow Vane · Chicago, Mar 14", kind: "show", tone: TONES[0], headliner: "Marlow Vane", city: "Chicago", date: "Mar 14", venue: "The Thalia Room", capacity: 1100, createdAt: now - 3 * 1440 * min, updatedAt: now - 42 * min },
    { id: "p-spring", name: "Marlow Vane · Spring tour", kind: "tour", tone: TONES[2], headliner: "Marlow Vane", city: "Midwest", date: "March", venue: "8 cities", capacity: 1000, createdAt: now - 6 * 1440 * min, updatedAt: now - 3 * 60 * min },
    { id: "p-fridays", name: "Northside Fridays", kind: "show", tone: TONES[1], headliner: "Various", city: "Chicago", date: "Weekly", venue: "Lantern Works", capacity: 650, createdAt: now - 20 * 1440 * min, updatedAt: now - 2 * 1440 * min },
  ];
  const chat = (id: string, projectId: string, ask: string, ago: number): Conversation => {
    const reply = (demo.replies as Record<string, { title: string; text: string; steps: Message["steps"]; artifacts: Message["artifacts"] }>)[id];
    const t = now - ago * min;
    const message: Message = { id: `${id}-a`, role: "assistant", text: reply.text, createdAt: t, steps: reply.steps, artifacts: reply.artifacts };
    return { id, projectId, title: reply.title, mode: "auto", updatedAt: t, messages: [{ id: `${id}-q`, role: "user", text: ask, createdAt: t - 4000 }, message] };
  };
  const conversations = [
    chat("demo", "p-chicago", "Find an opener for Marlow Vane in Chicago, Mar 14. Roster only.", 42),
    chat("demo-route", "p-spring", "Which cities should Marlow Vane play on a Midwest leg in March?", 180),
    chat("demo-sponsors", "p-chicago", "Find sponsors whose customers love Marlow Vane, for the Chicago show.", 300),
  ];
  const saved: SavedArtifact[] = [
    { projectId: "p-chicago", conversationId: "demo", artifact: conversations[0].messages[1].artifacts![0], savedAt: now - 40 * min },
    { projectId: "p-spring", conversationId: "demo-route", artifact: conversations[1].messages[1].artifacts![0], savedAt: now - 170 * min },
    { projectId: "p-chicago", conversationId: "demo-sponsors", artifact: conversations[2].messages[1].artifacts![0], savedAt: now - 290 * min },
  ];
  return { conversations, projects, saved, workspace: DEFAULT_WORKSPACE, team: DEFAULT_TEAM, rosters: DEFAULT_ROSTERS };
}

// state saved before settings existed gets the defaults
const complete = (s: Partial<State>): State => ({
  ...EMPTY,
  ...s,
  workspace: { ...DEFAULT_WORKSPACE, ...s.workspace },
  team: s.team ?? DEFAULT_TEAM,
  rosters: s.rosters ?? DEFAULT_ROSTERS,
} as State);

const REMOTE = accountsOn;
let loaded = !REMOTE;

function read(): State {
  if (cache) return cache;
  if (REMOTE) {
    cache = { ...EMPTY, workspace: { ...DEFAULT_WORKSPACE, onboarded: true } };
    if (typeof window !== "undefined") void pull();
    return cache;
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      cache = complete(JSON.parse(raw) as Partial<State>);
    } else {
      cache = seed();
      // keep chats made before projects existed
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const old = (JSON.parse(legacy) as (Conversation & { project?: string })[]).filter((c) => c.id !== "demo");
        cache.conversations.push(...old.map(({ project: _p, ...c }) => c));
      }
    }
  } catch {
    cache = seed();
  }
  return cache;
}

function write(next: State, ops: Op[] = []) {
  cache = next;
  if (REMOTE) queue(ops);
  else {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // storage blocked: keep the in-memory copy for this tab
    }
  }
  listeners.forEach((l) => l());
}

// ---------- server sync (accounts on) ----------

let pending: Op[] = [];
let flushing: Promise<void> | null = null;

function queue(ops: Op[]) {
  if (ops.length === 0) return;
  pending.push(...ops);
  flushing ??= Promise.resolve().then(flush);
}

async function flush() {
  while (pending.length) {
    const batch = pending.splice(0, 50);
    try {
      const res = await fetch("/api/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ops: batch }) });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);
    } catch (e) {
      // the server is the truth: drop what failed, say so, and reload what it holds
      pending = [];
      toast(e instanceof Error && !/^HTTP|fetch/i.test(e.message) ? e.message : "Could not save your last change. Reloaded the workspace.");
      await pull();
    }
  }
  flushing = null;
}

async function pull() {
  try {
    const res = await fetch("/api/bootstrap");
    if (res.status === 401) return window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const b = (await res.json()) as State & { workspaces: State["memberships"] };
    cache = complete({ conversations: b.conversations, projects: b.projects, saved: b.saved, workspace: b.workspace, team: b.team, rosters: b.rosters, memberships: b.workspaces, current: b.current });
    loaded = true;
    listeners.forEach((l) => l());
    offerImport();
  } catch {
    toast("Could not load your workspace. Check the connection and reload.");
  }
}

// Demo rows a fresh browser starts with; they stay behind when a browser's chats move to the server.
const DEMO_IDS = new Set(["demo", "demo-route", "demo-sponsors", "p-chicago", "p-spring", "p-fridays", "r-northlight"]);

function offerImport() {
  let local: Partial<State> | null = null;
  try {
    const raw = localStorage.getItem(KEY);
    local = raw ? (JSON.parse(raw) as Partial<State>) : null;
  } catch {
    return;
  }
  if (!local) return;
  const conversations = (local.conversations ?? []).filter((c) => !DEMO_IDS.has(c.id));
  const projects = (local.projects ?? []).filter((p) => !DEMO_IDS.has(p.id));
  const rosters = (local.rosters ?? []).filter((r) => !DEMO_IDS.has(r.id));
  const forget = () => {
    try {
      localStorage.removeItem(KEY);
    } catch {}
  };
  if (!conversations.length && !projects.length && !rosters.length) return forget();
  const keep = new Set(projects.map((p) => p.id));
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  toast(`Import ${plural(conversations.length, "chat")} and ${plural(projects.length, "project")} from this browser?`, {
    label: "Import",
    run: () => {
      const s = read();
      const ops: Op[] = [
        ...projects.map((project): Op => ({ op: "project.put", project })),
        ...rosters.map((roster): Op => ({ op: "roster.put", roster })),
        ...conversations.map((c): Op => ({ op: "conversation.put", conversation: { ...c, projectId: c.projectId && keep.has(c.projectId) ? c.projectId : undefined } })),
        ...(local!.saved ?? []).filter((x) => keep.has(x.projectId)).map((x): Op => ({ op: "saved.put", projectId: x.projectId, artifactId: x.artifact.id, conversationId: x.conversationId })),
      ];
      write({ ...s, projects: [...projects, ...s.projects], rosters: [...rosters, ...s.rosters], conversations: byRecent([...conversations, ...s.conversations]) }, ops);
      forget();
    },
  });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const byRecent = <T extends { updatedAt: number }>(xs: T[]) => [...xs].sort((a, b) => b.updatedAt - a.updatedAt);

// ---------- reads ----------

export const useConversations = () => useSyncExternalStore(subscribe, () => read().conversations, () => EMPTY.conversations);
export const useProjects = () => useSyncExternalStore(subscribe, () => read().projects, () => EMPTY.projects);
export const useSaved = () => useSyncExternalStore(subscribe, () => read().saved, () => EMPTY.saved);
export const useWorkspace = () => useSyncExternalStore(subscribe, () => read().workspace, () => EMPTY.workspace);
export const useTeam = () => useSyncExternalStore(subscribe, () => read().team, () => EMPTY.team);
export const useRosters = () => useSyncExternalStore(subscribe, () => read().rosters, () => EMPTY.rosters);
const NO_MEMBERSHIPS: NonNullable<State["memberships"]> = [];
export const useMemberships = () => useSyncExternalStore(subscribe, () => read().memberships ?? NO_MEMBERSHIPS, () => NO_MEMBERSHIPS);
export const useCurrentWorkspaceId = () => useSyncExternalStore(subscribe, () => read().current, () => undefined);
export const useHydrated = () => useSyncExternalStore(subscribe, () => loaded, () => false);

export function useConversation(id: string | null) {
  const all = useConversations();
  return id ? all.find((c) => c.id === id) : undefined;
}

export function useProject(id: string | null | undefined) {
  const all = useProjects();
  return id ? all.find((p) => p.id === id) : undefined;
}

// ---------- writes ----------

export function saveConversation(c: Conversation) {
  const s = read();
  write({ ...s, conversations: byRecent([c, ...s.conversations.filter((x) => x.id !== c.id)]) }, [{ op: "conversation.put", conversation: c }]);
  if (c.projectId) touchProject(c.projectId);
}

export function deleteConversation(id: string) {
  const s = read();
  write({ ...s, conversations: s.conversations.filter((c) => c.id !== id) }, [{ op: "conversation.delete", id }]);
}

export function setConversationProject(conversationId: string, projectId: string | undefined) {
  const s = read();
  const conversations = s.conversations.map((c) => (c.id === conversationId ? { ...c, projectId } : c));
  const moved = conversations.find((c) => c.id === conversationId);
  write({ ...s, conversations }, moved ? [{ op: "conversation.put", conversation: { ...moved, messages: [] } }] : []);
  if (projectId) touchProject(projectId);
}

export function createProject(p: Omit<Project, "id" | "createdAt" | "updatedAt" | "tone">): Project {
  const s = read();
  const project: Project = { ...p, id: `p-${newId()}`, tone: TONES[s.projects.length % TONES.length], createdAt: Date.now(), updatedAt: Date.now() };
  write({ ...s, projects: [project, ...s.projects] }, [{ op: "project.put", project }]);
  return project;
}

export function updateProject(id: string, patch: Partial<Omit<Project, "id">>) {
  const s = read();
  const projects = s.projects.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p));
  const p = projects.find((x) => x.id === id);
  write({ ...s, projects }, p ? [{ op: "project.put", project: p }] : []);
}

// Deleting a project keeps its chats; they just lose the link.
export function deleteProject(id: string) {
  const s = read();
  write({
    ...s,
    conversations: s.conversations.map((c) => (c.projectId === id ? { ...c, projectId: undefined } : c)),
    projects: s.projects.filter((p) => p.id !== id),
    saved: s.saved.filter((x) => x.projectId !== id),
  }, [{ op: "project.delete", id }]);
}

function touchProject(id: string) {
  const s = read();
  const projects = byRecent(s.projects.map((p) => (p.id === id ? { ...p, updatedAt: Date.now() } : p)));
  const p = projects.find((x) => x.id === id);
  write({ ...s, projects }, p ? [{ op: "project.put", project: p }] : []);
}

export function saveArtifact(projectId: string, artifact: Artifact, conversationId?: string) {
  const s = read();
  const rest = s.saved.filter((x) => !(x.projectId === projectId && x.artifact.id === artifact.id));
  write({ ...s, saved: [{ projectId, conversationId, artifact, savedAt: Date.now() }, ...rest] }, [{ op: "saved.put", projectId, artifactId: artifact.id, conversationId }]);
  touchProject(projectId);
}

export function unsaveArtifact(projectId: string, artifactId: string) {
  const s = read();
  write({ ...s, saved: s.saved.filter((x) => !(x.projectId === projectId && x.artifact.id === artifactId)) }, [{ op: "saved.delete", projectId, artifactId }]);
}

// An edit made anywhere (chat panel or project page) updates every copy of that artifact.
export function updateArtifact(artifact: Artifact) {
  const s = read();
  write({
    ...s,
    conversations: s.conversations.map((c) =>
      c.messages.some((m) => m.artifacts?.some((a) => a.id === artifact.id))
        ? { ...c, messages: c.messages.map((m) => (m.artifacts ? { ...m, artifacts: m.artifacts.map((a) => (a.id === artifact.id ? artifact : a)) } : m)) }
        : c,
    ),
    saved: s.saved.map((x) => (x.artifact.id === artifact.id ? { ...x, artifact } : x)),
  }, [{ op: "artifact.put", artifact }]);
}

// ---------- workspace ----------

export function updateWorkspace(patch: Partial<Workspace>) {
  const s = read();
  write({ ...s, workspace: { ...s.workspace, ...patch } }, [{ op: "workspace.patch", patch }]);
}

export function inviteMember(email: string, role: Member["role"]) {
  const s = read();
  const name = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  write({ ...s, team: [...s.team, { id: `m-${newId()}`, name, email, role, status: "invited" }] }, [{ op: "member.invite", email, role }]);
  // the server picks the member's id; reload so later edits address the right row
  if (REMOTE) void (flushing ?? Promise.resolve()).then(pull);
}

export function updateMember(id: string, patch: Partial<Member>) {
  const s = read();
  write({ ...s, team: s.team.map((m) => (m.id === id ? { ...m, ...patch } : m)) }, [{ op: "member.patch", id, patch: { ...(patch.role ? { role: patch.role } : {}), ...(patch.name ? { name: patch.name } : {}) } }]);
}

export function removeMember(id: string) {
  const s = read();
  write({ ...s, team: s.team.filter((m) => m.id !== id) }, [{ op: "member.remove", id }]);
}

export function saveRoster(name: string, acts: Roster["acts"]): Roster {
  const s = read();
  const roster: Roster = { id: `r-${newId()}`, name, acts, createdAt: Date.now() };
  write({ ...s, rosters: [roster, ...s.rosters] }, [{ op: "roster.put", roster }]);
  return roster;
}

export function deleteRoster(id: string) {
  const s = read();
  write({ ...s, rosters: s.rosters.filter((r) => r.id !== id) }, [{ op: "roster.delete", id }]);
}

// Clears everything in this browser and starts again from the demo workspace.
export function resetWorkspace() {
  if (REMOTE) return void pull();
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // storage blocked: the in-memory reset below still applies
  }
  cache = null;
  write(read());
}
