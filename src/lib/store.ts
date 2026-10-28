"use client";

// Workspace data lives in localStorage until the backend has persistence.
// Components read through the use* hooks and write through the actions below.

import { useSyncExternalStore } from "react";
import { mockReply } from "./agent/mock";
import type { Artifact, Conversation } from "./agent/types";
import { TONES, type Project, type SavedArtifact } from "./model";

type State = { conversations: Conversation[]; projects: Project[]; saved: SavedArtifact[] };

const KEY = "swami.state.v2";
const LEGACY_KEY = "swami.conversations.v1";
const EMPTY: State = { conversations: [], projects: [], saved: [] };
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
    const reply = mockReply({ conversationId: id, mode: "auto", messages: [{ role: "user", text: ask }] });
    const t = now - ago * min;
    return { id, projectId, title: reply.title, mode: "auto", updatedAt: t, messages: [{ id: `${id}-q`, role: "user", text: ask, createdAt: t - 4000 }, { ...reply.message, createdAt: t }] };
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
  return { conversations, projects, saved };
}

function read(): State {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      cache = JSON.parse(raw) as State;
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

function write(next: State) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage blocked: keep the in-memory copy for this tab
  }
  listeners.forEach((l) => l());
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
export const useHydrated = () => useSyncExternalStore(subscribe, () => true, () => false);

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
  write({ ...s, conversations: byRecent([c, ...s.conversations.filter((x) => x.id !== c.id)]) });
  if (c.projectId) touchProject(c.projectId);
}

export function deleteConversation(id: string) {
  const s = read();
  write({ ...s, conversations: s.conversations.filter((c) => c.id !== id) });
}

export function setConversationProject(conversationId: string, projectId: string | undefined) {
  const s = read();
  write({ ...s, conversations: s.conversations.map((c) => (c.id === conversationId ? { ...c, projectId } : c)) });
  if (projectId) touchProject(projectId);
}

export function createProject(p: Omit<Project, "id" | "createdAt" | "updatedAt" | "tone">): Project {
  const s = read();
  const project: Project = { ...p, id: `p-${newId()}`, tone: TONES[s.projects.length % TONES.length], createdAt: Date.now(), updatedAt: Date.now() };
  write({ ...s, projects: [project, ...s.projects] });
  return project;
}

export function updateProject(id: string, patch: Partial<Omit<Project, "id">>) {
  const s = read();
  write({ ...s, projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)) });
}

// Deleting a project keeps its chats; they just lose the link.
export function deleteProject(id: string) {
  const s = read();
  write({
    conversations: s.conversations.map((c) => (c.projectId === id ? { ...c, projectId: undefined } : c)),
    projects: s.projects.filter((p) => p.id !== id),
    saved: s.saved.filter((x) => x.projectId !== id),
  });
}

function touchProject(id: string) {
  const s = read();
  write({ ...s, projects: byRecent(s.projects.map((p) => (p.id === id ? { ...p, updatedAt: Date.now() } : p))) });
}

export function saveArtifact(projectId: string, artifact: Artifact, conversationId?: string) {
  const s = read();
  const rest = s.saved.filter((x) => !(x.projectId === projectId && x.artifact.id === artifact.id));
  write({ ...s, saved: [{ projectId, conversationId, artifact, savedAt: Date.now() }, ...rest] });
  touchProject(projectId);
}

export function unsaveArtifact(projectId: string, artifactId: string) {
  const s = read();
  write({ ...s, saved: s.saved.filter((x) => !(x.projectId === projectId && x.artifact.id === artifactId)) });
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
  });
}
