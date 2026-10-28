"use client";

// Conversations live in localStorage until the backend has persistence.
// Components read them through useConversations/useConversation and write through saveConversation.

import { useSyncExternalStore } from "react";
import { mockReply } from "./agent/mock";
import type { Conversation } from "./agent/types";

const KEY = "swami.conversations.v1";
const EMPTY: Conversation[] = [];
let cache: Conversation[] | null = null;
const listeners = new Set<() => void>();

function seed(): Conversation[] {
  const ask = "Find an opener for Marlow Vane in Chicago, Mar 14. Roster only.";
  const reply = mockReply({ conversationId: "demo", mode: "auto", messages: [{ role: "user", text: ask }] });
  const t = Date.now() - 1000 * 60 * 42;
  return [
    {
      id: "demo",
      title: reply.title,
      project: "Marlow Vane · Spring tour",
      mode: "auto",
      updatedAt: t,
      messages: [{ id: "demo-q", role: "user", text: ask, createdAt: t - 4000 }, { ...reply.message, createdAt: t }],
    },
  ];
}

function read(): Conversation[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Conversation[]) : seed();
  } catch {
    cache = seed();
  }
  return cache;
}

function write(next: Conversation[]) {
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

export function useConversations() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function useConversation(id: string | null) {
  const all = useConversations();
  return id ? all.find((c) => c.id === id) : undefined;
}

export function saveConversation(c: Conversation) {
  const rest = read().filter((x) => x.id !== c.id);
  write([c, ...rest].sort((a, b) => b.updatedAt - a.updatedAt));
}

export function deleteConversation(id: string) {
  write(read().filter((c) => c.id !== id));
}

export const newId = () => Math.random().toString(36).slice(2, 10);
