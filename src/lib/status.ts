"use client";

import { useSyncExternalStore } from "react";

export type ServerStatus = { data: "live" | "fixture"; agent: "model" | "templates"; accounts: boolean };

// Until the server answers, assume demo data: the label errs toward saying less than it knows.
let status: ServerStatus = { data: "fixture", agent: "templates", accounts: false };
let asked = false;
const listeners = new Set<() => void>();

function load() {
  if (asked) return;
  asked = true;
  fetch("/api/status")
    .then((r) => (r.ok ? r.json() : null))
    .then((s: ServerStatus | null) => {
      if (!s) return;
      status = s;
      listeners.forEach((l) => l());
    })
    .catch(() => {});
}

export function useServerStatus(): ServerStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      load();
      return () => listeners.delete(l);
    },
    () => status,
    () => status,
  );
}
