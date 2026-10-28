"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { site } from "@/lib/site";
import { useConversations, useProjects } from "@/lib/store";
import { Logo } from "../landing/Logo";
import { IconChat, IconClose, IconFolder, IconPlus, IconSearch, IconSettings, IconSidebar } from "./icons";
import s from "./AppShell.module.css";

type Shell = { openNav: () => void };
const ShellContext = createContext<Shell>({ openNav: () => {} });
export const useShell = () => useContext(ShellContext);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const conversations = useConversations();
  const projects = useProjects();
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");

  // close the phone drawer after navigating
  useEffect(() => setNavOpen(false), [pathname]);

  const recent = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? conversations.filter((c) => c.title.toLowerCase().includes(q)) : conversations;
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
            <button className={s.iconBtn} onClick={() => (navOpen ? setNavOpen(false) : setCollapsed(true))} aria-label="Hide sidebar">
              {navOpen ? <IconClose /> : <IconSidebar />}
            </button>
          </div>

          <Link href="/app" className={s.newChat}>
            <IconPlus />
            New chat
          </Link>

          <label className={s.search}>
            <IconSearch />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chats" />
          </label>

          <nav className={s.scroll}>
            <div className={s.groupRow}>
              <p className={s.group}>Projects</p>
              <Link href="/app/projects" className={s.groupLink}>
                View all
              </Link>
            </div>
            <ul className={s.list}>
              <li>
                <Link href="/app/projects" className={s.item} aria-current={pathname === "/app/projects" ? "page" : undefined}>
                  <IconFolder className={s.itemIcon} />
                  <span className={s.label}>All projects</span>
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
                  <li key={c.id}>
                    <Link href={href} className={s.item} aria-current={pathname === href ? "page" : undefined}>
                      <IconChat className={s.itemIcon} />
                      <span className={s.label}>{c.title}</span>
                    </Link>
                  </li>
                );
              })}
              {recent.length === 0 && <li className={s.empty}>{query ? "No chats match" : "Your chats show up here"}</li>}
            </ul>
          </nav>

          <div className={s.workspace}>
            <span className={s.avatar}>NL</span>
            <span className={s.wsText}>
              <b>Northside Live</b>
              <span>Season plan · 4 seats</span>
            </span>
            <button className={s.iconBtn} aria-label="Settings">
              <IconSettings />
            </button>
          </div>
        </aside>

        {navOpen && <button className={s.scrim} aria-label="Close menu" onClick={() => setNavOpen(false)} />}

        <div className={s.main}>{children}</div>
      </div>
    </ShellContext.Provider>
  );
}
