"use client";

// One toast at a time, shared by every page. Reversible actions pass an Undo instead of asking first.
import { useSyncExternalStore } from "react";

export type Toast = { id: number; text: string; action?: { label: string; run: () => void } };

let current: Toast | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(text: string, action?: Toast["action"]) {
  current = { id: Date.now(), text, action };
  clearTimeout(timer);
  timer = setTimeout(dismissToast, action ? 6000 : 2600);
  emit();
}

export function dismissToast() {
  current = null;
  emit();
}

export function useToast() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => null,
  );
}
