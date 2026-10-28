"use client";

import { useEffect, useMemo } from "react";
import { useConversations, useHydrated, useSaved } from "@/lib/store";
import { ProposalView } from "./artifacts/ProposalView";
import s from "./PrintView.module.css";

// A bare page holding one proposal, opened in its own tab so the browser can save it as PDF.
export function PrintView({ id }: { id: string }) {
  const hydrated = useHydrated();
  const conversations = useConversations();
  const saved = useSaved();

  const artifact = useMemo(() => {
    const all = [...saved.map((x) => x.artifact), ...conversations.flatMap((c) => c.messages.flatMap((m) => m.artifacts ?? []))];
    return all.find((a) => a.id === id);
  }, [saved, conversations, id]);

  useEffect(() => {
    if (artifact?.type !== "proposal") return;
    document.title = artifact.title;
    let cancelled = false;
    // wait for the serif to load so the PDF matches the screen
    document.fonts.ready.then(() => !cancelled && setTimeout(() => window.print(), 250));
    return () => {
      cancelled = true;
    };
  }, [artifact]);

  if (!hydrated) return null;
  if (!artifact || artifact.type !== "proposal") {
    return <p className={s.missing}>This proposal is stored in another browser or was deleted.</p>;
  }
  return (
    <main className={s.sheet}>
      <ProposalView artifact={artifact} readOnly />
    </main>
  );
}
