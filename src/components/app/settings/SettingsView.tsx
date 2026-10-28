"use client";

import { supabaseBrowser } from "@/lib/db/browser";
import { useServerStatus } from "@/lib/status";
import { toast } from "@/lib/toast";
import { useEffect, useState } from "react";
import { ROLES, type Member, type Workspace } from "@/lib/model";
import {
  deleteRoster,
  inviteMember,
  removeMember,
  resetWorkspace,
  useCurrentWorkspaceId,
  useMemberships,
  updateMember,
  updateWorkspace,
  useConversations,
  useHydrated,
  useRosters,
  useTeam,
  useWorkspace,
} from "@/lib/store";
import { useShell } from "../AppShell";
import { timeAgo } from "../artifacts/meta";
import { ChipInput } from "../ChipInput";
import { IconCheck, IconClose, IconMenu, IconPlus } from "../icons";
import { RosterDialog } from "./RosterDialog";
import p from "../projects/Projects.module.css";
import s from "./Settings.module.css";

const TABS = [
  { id: "workspace", label: "Workspace" },
  { id: "team", label: "Team" },
  { id: "rosters", label: "Rosters" },
  { id: "data", label: "Data sources" },
  { id: "billing", label: "Billing" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const PLANS: { id: Workspace["plan"]; name: string; price: string }[] = [
  { id: "single", name: "Single show", price: "$39 per show" },
  { id: "season", name: "Season", price: "$490 per month" },
  { id: "group", name: "Venue group", price: "Custom" },
];

export function SettingsView() {
  const { openNav } = useShell();
  const hydrated = useHydrated();
  const [tab, setTab] = useState<Tab>("workspace");
  const setToast = (m: string | null) => m && toast(m);

  // the tab lives in the URL so links like /app/settings?tab=rosters land on it
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    if (t && TABS.some((x) => x.id === t)) setTab(t);
  }, []);

  const pick = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, "", `/app/settings?tab=${t}`);
  };

  return (
    <div className={p.page}>
      <div className={p.main}>
        <header className={p.bar}>
          <button className={p.iconBtn} onClick={openNav} aria-label="Open sidebar">
            <IconMenu />
          </button>
          <h1 className={p.barTitle}>Settings</h1>
        </header>
        <div className={p.scroll}>
          <div className={`${p.inner} ${s.layout}`}>
            <nav className={s.nav} role="tablist" aria-label="Settings">
              {TABS.map((t) => (
                <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => pick(t.id)}>
                  {t.label}
                </button>
              ))}
            </nav>
            <div className={s.panel}>
              {hydrated && tab === "workspace" && <WorkspaceTab onToast={setToast} />}
              {hydrated && tab === "team" && <TeamTab onToast={setToast} />}
              {hydrated && tab === "rosters" && <RostersTab onToast={setToast} />}
              {hydrated && tab === "data" && <DataTab />}
              {hydrated && tab === "billing" && <BillingTab onToast={setToast} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className={s.section}>
      <div className={s.sectionHead}>
        <h2>{title}</h2>
        {hint && <p>{hint}</p>}
      </div>
      <div className={s.sectionBody}>{children}</div>
    </section>
  );
}

function WorkspaceTab({ onToast }: { onToast: (m: string) => void }) {
  const ws = useWorkspace();
  const { accounts } = useServerStatus();
  const memberships = useMemberships();
  const current = useCurrentWorkspaceId();
  const [name, setName] = useState(ws.name);
  return (
    <>
      <Section title="Workspace" hint="Your company name signs every proposal and email draft.">
        <label className={s.field}>
          <span>Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (name.trim() && name.trim() !== ws.name) {
                updateWorkspace({ name: name.trim() });
                onToast("Workspace name saved");
              }
            }}
          />
        </label>
      </Section>
      <Section title="Your role" hint="Shapes the templates and the tasks Swami suggests.">
        <div className={s.roleGrid} role="radiogroup">
          {ROLES.map((r) => (
            <button
              key={r.id}
              role="radio"
              aria-checked={ws.role === r.id}
              onClick={() => {
                updateWorkspace({ role: r.id });
                onToast(`Role set to ${r.label.toLowerCase()}`);
              }}
            >
              <b>{r.label}</b>
              <span>{r.blurb}</span>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Markets" hint="Default cities for maps, venues and partners.">
        <ChipInput label="Cities" values={ws.cities} onChange={(cities) => updateWorkspace({ cities })} placeholder="Add a city" />
      </Section>
      <Section title="Artists" hint="Quick tasks on a new chat start from these names.">
        <ChipInput label="Artists" values={ws.artists} onChange={(artists) => updateWorkspace({ artists })} placeholder="Add an artist" />
      </Section>
      {memberships.length > 1 && (
        <Section title="Workspaces" hint="You belong to more than one. Pick the one this browser opens.">
          <div className={s.roleGrid} role="radiogroup">
            {memberships.map((m) => (
              <button
                key={m.id}
                role="radio"
                aria-checked={m.id === current}
                onClick={async () => {
                  if (m.id === current) return;
                  const res = await fetch("/api/workspace", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: m.id }) });
                  if (res.ok) window.location.assign("/app");
                  else onToast("Could not switch workspaces");
                }}
              >
                <b>{m.name}</b>
                <span>{m.role}</span>
              </button>
            ))}
          </div>
        </Section>
      )}
      {accounts ? (
        <Section title="Account" hint="Your workspace is saved on the server and follows you to any browser.">
          <div>
            <button
              className={s.danger}
              onClick={async () => {
                await supabaseBrowser().auth.signOut();
                window.location.assign("/");
              }}
            >
              Sign out
            </button>
          </div>
        </Section>
      ) : (
        <Section title="Start over" hint="Clears every chat, project and setting in this browser and reloads the demo workspace.">
          <div>
            <button
              className={s.danger}
              onClick={() => {
                if (window.confirm("Reset this workspace? Chats, projects, rosters and settings in this browser are deleted.")) resetWorkspace();
              }}
            >
              Reset workspace
            </button>
          </div>
        </Section>
      )}
    </>
  );
}

function TeamTab({ onToast }: { onToast: (m: string) => void }) {
  const team = useTeam();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Member["role"]>("Editor");
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  return (
    <>
      <Section title="Invite" hint="Editors can chat and edit projects. Viewers can read and export.">
        <form
          className={s.invite}
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            inviteMember(email.trim(), role);
            onToast(`Invite added for ${email.trim()}. Emails go out once accounts are live.`);
            setEmail("");
          }}
        >
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" aria-label="Email" />
          <select value={role} onChange={(e) => setRole(e.target.value as Member["role"])} aria-label="Role">
            <option>Editor</option>
            <option>Viewer</option>
          </select>
          <button className="button button-ink" disabled={!valid}>
            <IconPlus />
            Invite
          </button>
        </form>
      </Section>
      <Section title={`Members · ${team.length}`}>
        <ul className={s.members}>
          {team.map((m) => (
            <li key={m.id}>
              <span className={s.avatar}>
                {m.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)}
              </span>
              <span className={s.who}>
                <b>
                  {m.name}
                  {m.status === "invited" && <em>Invited</em>}
                </b>
                <span>{m.email}</span>
              </span>
              {m.role === "Owner" ? (
                <span className={s.owner}>Owner</span>
              ) : (
                <>
                  <select value={m.role} onChange={(e) => updateMember(m.id, { role: e.target.value as Member["role"] })} aria-label={`Role for ${m.name}`}>
                    <option>Editor</option>
                    <option>Viewer</option>
                  </select>
                  <button className={s.remove} onClick={() => removeMember(m.id)} aria-label={`Remove ${m.name}`}>
                    <IconClose />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

function RostersTab({ onToast }: { onToast: (m: string) => void }) {
  const rosters = useRosters();
  const [importing, setImporting] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <Section title="Rosters" hint="Attach a roster in the chat with the Roster button, and rankings stay inside it.">
        <div className={s.rosterHead}>
          <span>
            {rosters.length} roster{rosters.length === 1 ? "" : "s"}
          </span>
          <button className="button button-ink" onClick={() => setImporting(true)}>
            <IconPlus />
            Import roster
          </button>
        </div>
        {rosters.length === 0 ? (
          <p className={s.emptyNote}>No rosters yet. Paste a list or upload a CSV from your agency.</p>
        ) : (
          <ul className={s.rosters}>
            {rosters.map((r) => (
              <li key={r.id} data-open={open === r.id || undefined}>
                <button className={s.rosterRow} onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
                  <b>{r.name}</b>
                  <span>
                    {r.acts.length} acts · added {timeAgo(r.createdAt)}
                  </span>
                </button>
                {open === r.id && (
                  <div className={s.acts}>
                    {r.acts.map((a) => (
                      <span key={a.name}>
                        {a.name}
                        {a.genre && <em>{a.genre}</em>}
                      </span>
                    ))}
                    <button
                      className={s.danger}
                      onClick={() => {
                        deleteRoster(r.id);
                        onToast(`Deleted ${r.name}`);
                      }}
                    >
                      Delete roster
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
      {importing && (
        <RosterDialog
          onClose={() => setImporting(false)}
          onSaved={(r) => {
            setImporting(false);
            setOpen(r.id);
            onToast(`Imported ${r.acts.length} acts`);
          }}
        />
      )}
    </>
  );
}

const SOURCES = [
  { name: "Ticketing", by: "Your ticketing system", status: "Ready to connect", note: "Joins door counts to promo links so rankings learn from what sold. Venue group plan.", tone: "off" },
  { name: "Mailing list", by: "Your email tool", status: "Ready to connect", note: "Sends approved drafts and tracks replies from agents, venues and sponsors.", tone: "off" },
] as const;

function DataTab() {
  const status = useServerStatus();
  const live = status.data === "live";
  const writing =
    status.agent === "model"
      ? { name: "Writing", by: "Swami agent", status: "On", note: "Plans which tools to run and writes the reply. Every number it writes is checked against the tools' results.", tone: "live" }
      : { name: "Writing", by: "Templates", status: "Templates", note: "Replies come from fixed templates filled with the tools' results. Connect a model and replies answer the question as asked.", tone: "off" };
  const taste = live
    ? { name: "Taste graph", by: "Qloo", status: "Live", note: "Artist affinity, neighbourhood heat, places, brands and demographics, fetched for every answer.", tone: "live" }
    : { name: "Taste graph", by: "Qloo", status: "Demo data", note: "Artist affinity, neighbourhood heat, places, brands and demographics. Every name and number is made up until the API key is connected.", tone: "demo" };
  return (
    <Section title="Data sources" hint="Where Swami's numbers come from. Every score in the app is labelled with its source.">
      <ul className={s.sources}>
        {[taste, writing, ...SOURCES].map((src) => (
          <li key={src.name}>
            <div>
              <b>{src.name}</b>
              <span>{src.by}</span>
            </div>
            <p>{src.note}</p>
            <span className={s.status} data-tone={src.tone}>
              {src.status}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function BillingTab({ onToast }: { onToast: (m: string) => void }) {
  const { accounts } = useServerStatus();
  const [usage, setUsage] = useState<{ runs: number; qlooCalls: number } | null>(null);
  useEffect(() => {
    if (!accounts) return;
    fetch("/api/usage")
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => u && setUsage(u))
      .catch(() => {});
  }, [accounts]);
  const ws = useWorkspace();
  const team = useTeam();
  const conversations = useConversations();
  const month = new Date();
  const results = conversations
    .flatMap((c) => c.messages)
    .filter((m) => {
      const d = new Date(m.createdAt);
      return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
    })
    .flatMap((m) => m.artifacts ?? []).length;
  return (
    <>
      <Section title="Plan" hint="Prices are placeholders while Swami is in preview.">
        <div className={s.plans} role="radiogroup">
          {PLANS.map((pl) => (
            <button
              key={pl.id}
              role="radio"
              aria-checked={ws.plan === pl.id}
              onClick={() => {
                updateWorkspace({ plan: pl.id });
                onToast(`Plan set to ${pl.name}`);
              }}
            >
              <b>{pl.name}</b>
              <span>{pl.price}</span>
            </button>
          ))}
        </div>
      </Section>
      <Section title="This month">
        <dl className={s.usage}>
          {usage ? (
            <>
              <div>
                <dt>Chat runs</dt>
                <dd>{usage.runs}</dd>
              </div>
              <div>
                <dt>Taste-graph calls</dt>
                <dd>{usage.qlooCalls}</dd>
              </div>
            </>
          ) : (
            <div>
              <dt>Results generated</dt>
              <dd>{results}</dd>
            </div>
          )}
          <div>
            <dt>Seats</dt>
            <dd>{team.length}</dd>
          </div>
          <div>
            <dt>Chats</dt>
            <dd>{conversations.length}</dd>
          </div>
        </dl>
      </Section>
    </>
  );
}
