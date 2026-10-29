"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { site } from "@/lib/site";
import { deleteConversation, saveConversation, useConversations, useHydrated, useProjects, useTeam, useWorkspace } from "@/lib/store";
import { Logo } from "../landing/Logo";
import { IconChat, IconClose, IconFolder, IconPlus, IconSearch, IconSettings, IconSidebar, IconTrash } from "./icons";
import { Onboarding } from "./onboarding/Onboarding";
import { Toaster } from "./Toaster";
import { toast } from "@/lib/toast";
import s from "./AppShell.module.css";

type Shell = { openNav: () => void };
const ShellContext = createContext<Shell>({ openNav: () => {} });
export const useShell = () => useContext(ShellContext);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const conversations = useConversations();
  const projects = useProjects();
  const workspace = useWorkspace();
  const team = useTeam();
  const hydrated = useHydrated();
  const initials = workspace.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const planLabel = { single: "Single show", season: "Season plan", group: "Venue group" }[workspace.plan];
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");

  // close the phone drawer after navigating
  useEffect(() => setNavOpen(false), [pathname]);

  const recent = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    // titles first, then chats that mention it in a question, a reply or a result's title
    const inTitle = conversations.filter((c) => c.title.toLowerCase().includes(q));
    const inBody = conversations.filter(
      (c) => !inTitle.includes(c) && c.messages.some((m) => m.text.toLowerCase().includes(q) || m.artifacts?.some((a) => a.title.toLowerCase().includes(q))),
    );
    return [...inTitle, ...inBody];
  }, [conversations, query]);

  const shell = useMemo(() => ({ openNav: () => (collapsed ? setCollapsed(false) : setNavOpen(true)) }), [collapsed]);

  return (
    <ShellContext.Provider value={shell}>
      <div className={s.shell} data-collapsed={collapsed || undefined}>
        <aside className={s.sidebar} data-open={navOpen || undefined} aria-label="Workspace">
          <div className={s.top}>
            <Link href="/" className={s.brand}>
              <Logo className={s.logo} />
              {site.name}
            </Link>
            <button className={s.iconBtn} onClick={() => (navOpen ? setNavOpen(false) : setCollapsed(true))} aria-label="Hide sidebar" data-tip={navOpen ? "Close" : "Hide sidebar"} data-tip-pos="end">
              {navOpen ? <IconClose /> : <IconSidebar />}
            </button>
          </div>

          <Link href="/app" className={s.newChat}>
            <IconPlus />
            New Chat
          </Link>

          <label className={s.search}>
            <IconSearch />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chats" />
          </label>

          <nav className={s.scroll}>
            <div className={s.groupRow}>
              <p className={s.group}>Projects</p>
              <Link href="/app/projects?new=1" className={s.groupAdd} aria-label="New project" data-tip="New project" data-tip-pos="end">
                <IconPlus />
              </Link>
            </div>
            <ul className={s.list}>
              <li>
                <Link href="/app/projects" className={s.item} aria-current={pathname === "/app/projects" ? "page" : undefined}>
                  <IconFolder className={s.itemIcon} />
                  <span className={s.label}>All Projects</span>
                </Link>
              </li>
              {projects.slice(0, 6).map((p) => {
                const href = `/app/projects/${p.id}`;
                const chats = conversations.filter((c) => c.projectId === p.id).length;
                return (
                  <li key={p.id}>
                    <Link href={href} className={s.item} aria-current={pathname === href ? "page" : undefined}>
                      <i className={s.swatch} style={{ background: p.tone }} />
                      <span className={s.label}>{p.name}</span>
                      <span className={s.count}>{chats}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <p className={s.group}>Recent</p>
            <ul className={s.list}>
              {recent.map((c) => {
                const href = `/app/c/${c.id}`;
                return (
                  <li key={c.id} className={s.row}>
                    <Link href={href} className={s.item} aria-current={pathname === href ? "page" : undefined}>
                      <IconChat className={s.itemIcon} />
                      <span className={s.label}>{c.title}</span>
                    </Link>
                    <button
                      className={s.rowAction}
                      aria-label={`Delete ${c.title}`}
                      data-tip="Delete chat"
                      data-tip-pos="end"
                      onClick={() => {
                        deleteConversation(c.id);
                        if (pathname === href) router.push("/app");
                        toast(`Deleted “${c.title}”`, { label: "Undo", run: () => saveConversation(c) });
                      }}
                    >
                      <IconTrash />
                    </button>
                  </li>
                );
              })}
              {recent.length === 0 && <li className={s.empty}>{query ? "No chats match" : "Your chats show up here"}</li>}
            </ul>
          </nav>

          <Link href="/app/settings" className={s.workspace} aria-current={pathname.startsWith("/app/settings") ? "page" : undefined}>
            <span className={s.avatar}>{hydrated ? initials : ""}</span>
            <span className={s.wsText}>
              <b>{hydrated ? workspace.name : "\u00a0"}</b>
              <span>{hydrated ? `${planLabel} · ${team.length} seat${team.length === 1 ? "" : "s"}` : "\u00a0"}</span>
            </span>
            <span className={s.iconBtn} aria-hidden="true">
              <IconSettings />
            </span>
          </Link>
        </aside>

        {navOpen && <button className={s.scrim} aria-label="Close menu" onClick={() => setNavOpen(false)} />}

        <div className={s.main}>{children}</div>
        {hydrated && !workspace.onboarded && <Onboarding />}
        <Toaster />
      </div>
    </ShellContext.Provider>
  );
}
