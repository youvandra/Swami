import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Artifact, Conversation, Message } from "../agent/types.ts";
import type { Member, Project, Roster, SavedArtifact, Workspace } from "../model.ts";
import type { Op } from "./sync.ts";
import { env } from "../env.ts";
import { sendInvite } from "./admin.ts";

// Every query runs as the signed-in user; row-level security decides what exists. Rows map to the client's
// types here and nowhere else.

const RECENT_CHATS = 60;
const ms = (t: string | null) => (t ? Date.parse(t) : Date.now());
const iso = (n: number) => new Date(n).toISOString();

export class DbError extends Error {}
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- rows are untyped until a generated schema type exists
const must = <T = any>(r: { data: T | null; error: { message: string } | null }): NonNullable<T> | any[] => {
  if (r.error) throw new DbError(r.error.message);
  return (r.data ?? []) as NonNullable<T>;
};

export const WS_COOKIE = "swami.ws";

/** The workspaces the user belongs to, the one picked in this browser (cookie) first, else the one joined last. */
export async function memberships(sb: SupabaseClient): Promise<{ id: string; name: string; role: Member["role"] }[]> {
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return [];
  const rows = must(await sb.from("members").select("workspace_id, role, joined_at, workspaces(name)").eq("user_id", auth.user.id).eq("status", "active").order("joined_at", { ascending: false })) as { workspace_id: string; role: Member["role"]; workspaces: { name: string } | null }[];
  return rows.map((r) => ({ id: r.workspace_id, name: r.workspaces?.name ?? "Workspace", role: r.role }));
}

/** The workspace this request works in. */
export async function currentWorkspace(sb: SupabaseClient): Promise<{ id: string; role: Member["role"] } | null> {
  const all = await memberships(sb);
  const picked = (await cookies()).get(WS_COOKIE)?.value;
  const ws = all.find((w) => w.id === picked) ?? all[0];
  return ws ? { id: ws.id, role: ws.role } : null;
}

export type Bootstrap = {
  workspace: Workspace;
  team: Member[];
  projects: Project[];
  conversations: Conversation[];
  saved: SavedArtifact[];
  rosters: Roster[];
  you: { role: Member["role"]; email: string };
  workspaces: { id: string; name: string; role: Member["role"] }[];
  current: string;
};

export async function bootstrap(sb: SupabaseClient, ws: string): Promise<Bootstrap> {
  const { data: auth } = await sb.auth.getUser();
  const [w, team, projects, convs, rosters] = await Promise.all([
    sb.from("workspaces").select("*").eq("id", ws).single(),
    sb.from("members").select("*").eq("workspace_id", ws).order("role"),
    sb.from("projects").select("*").eq("workspace_id", ws).order("updated_at", { ascending: false }),
    sb.from("conversations").select("*").eq("workspace_id", ws).order("updated_at", { ascending: false }).limit(RECENT_CHATS),
    sb.from("rosters").select("*").eq("workspace_id", ws).order("created_at", { ascending: false }),
  ]);
  const convRows = must(convs);
  const ids = convRows.map((c) => c.id);
  const projectIds = must(projects).map((p) => p.id);
  const [msgs, arts, saved] = await Promise.all([
    ids.length ? sb.from("messages").select("*").in("conversation_id", ids).order("created_at") : Promise.resolve({ data: [], error: null }),
    sb.from("artifacts").select("id, message_id, position, data").eq("workspace_id", ws),
    projectIds.length ? sb.from("saved_artifacts").select("*").in("project_id", projectIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const artRows = must(arts) as { id: string; message_id: string; position: number; data: Artifact }[];
  const byMessage = new Map<string, Artifact[]>();
  for (const a of [...artRows].sort((x, y) => x.position - y.position)) (byMessage.get(a.message_id) ?? byMessage.set(a.message_id, []).get(a.message_id)!).push(a.data);
  const artById = new Map(artRows.map((a) => [a.id, a.data]));
  const byConv = new Map<string, Message[]>();
  for (const m of must(msgs) as { id: string; conversation_id: string; role: Message["role"]; text: string; steps: Message["steps"]; choices: Message["choices"]; created_at: string }[]) {
    const message: Message = { id: m.id, role: m.role, text: m.text, createdAt: ms(m.created_at), steps: m.steps ?? undefined, choices: m.choices ?? undefined, artifacts: byMessage.get(m.id) };
    (byConv.get(m.conversation_id) ?? byConv.set(m.conversation_id, []).get(m.conversation_id)!).push(message);
  }
  const wr = must(w);
  const teamRows = must(team) as { id: string; user_id: string | null; email: string; name: string | null; role: Member["role"]; status: Member["status"] }[];
  const me = teamRows.find((t) => t.user_id === auth.user?.id);
  return {
    workspace: { name: wr.name, role: wr.role, cities: wr.cities, artists: wr.artists, plan: wr.plan, onboarded: wr.onboarded },
    team: teamRows.map((t) => ({ id: t.id, email: t.email, name: t.name ?? t.email.split("@")[0], role: t.role, status: t.status })),
    projects: must(projects).map((p) => ({ id: p.id, name: p.name, kind: p.kind, tone: p.tone, headliner: p.headliner, city: p.city, date: p.date, venue: p.venue, capacity: p.capacity, createdAt: ms(p.created_at), updatedAt: ms(p.updated_at) })),
    conversations: convRows.map((c) => ({ id: c.id, title: c.title, projectId: c.project_id ?? undefined, mode: c.mode, updatedAt: ms(c.updated_at), entities: c.entities, messages: byConv.get(c.id) ?? [] })),
    saved: (must(saved) as { project_id: string; artifact_id: string; conversation_id: string | null; saved_at: string }[])
      .filter((s) => artById.has(s.artifact_id))
      .map((s) => ({ projectId: s.project_id, conversationId: s.conversation_id ?? undefined, artifact: artById.get(s.artifact_id)!, savedAt: ms(s.saved_at) })),
    rosters: must(rosters).map((r) => ({ id: r.id, name: r.name, acts: r.acts, createdAt: ms(r.created_at) })),
    you: { role: me?.role ?? "Viewer", email: auth.user?.email ?? "" },
    workspaces: await memberships(sb),
    current: ws,
  };
}

export async function apply(sb: SupabaseClient, ws: string, op: Op): Promise<void> {
  switch (op.op) {
    case "conversation.put": {
      const c = op.conversation;
      const { data: auth } = await sb.auth.getUser();
      must(await sb.from("conversations").upsert({ id: c.id, workspace_id: ws, project_id: c.projectId ?? null, title: c.title, mode: c.mode, entities: c.entities ?? {}, created_by: auth.user?.id ?? null, updated_at: iso(c.updatedAt) }));
      if (c.messages.length) {
        must(await sb.from("messages").upsert(c.messages.map((m) => ({ id: m.id, conversation_id: c.id, role: m.role, text: m.text, steps: m.steps ?? null, choices: m.choices ?? null, created_at: iso(m.createdAt) }))));
        const arts = c.messages.flatMap((m) => (m.artifacts ?? []).map((a, i) => ({ id: a.id, message_id: m.id, workspace_id: ws, type: a.type, position: i, data: a, updated_at: iso(Date.now()) })));
        if (arts.length) must(await sb.from("artifacts").upsert(arts));
      }
      return;
    }
    case "conversation.delete":
      must(await sb.from("conversations").delete().eq("id", op.id).eq("workspace_id", ws));
      return;
    case "project.put": {
      const p = op.project;
      must(await sb.from("projects").upsert({ id: p.id, workspace_id: ws, name: p.name, kind: p.kind, tone: p.tone, headliner: p.headliner, city: p.city, date: p.date, venue: p.venue, capacity: p.capacity, created_at: iso(p.createdAt), updated_at: iso(p.updatedAt) }));
      return;
    }
    case "project.delete":
      must(await sb.from("projects").delete().eq("id", op.id).eq("workspace_id", ws));
      return;
    case "saved.put":
      must(await sb.from("saved_artifacts").upsert({ project_id: op.projectId, artifact_id: op.artifactId, conversation_id: op.conversationId ?? null, saved_at: iso(Date.now()) }));
      return;
    case "saved.delete":
      must(await sb.from("saved_artifacts").delete().eq("project_id", op.projectId).eq("artifact_id", op.artifactId));
      return;
    case "artifact.put":
      must(await sb.from("artifacts").update({ data: op.artifact, updated_at: iso(Date.now()) }).eq("id", op.artifact.id).eq("workspace_id", ws));
      return;
    case "workspace.patch":
      must(await sb.from("workspaces").update(op.patch).eq("id", ws));
      return;
    case "member.invite": {
      const name = op.email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      must(await sb.from("members").insert({ workspace_id: ws, email: op.email.toLowerCase(), name, role: op.role, status: "invited" }));
      // the row is the invitation; the email is a courtesy, and an existing account simply joins on next login
      await sendInvite(op.email, `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/app`).catch(() => false);
      return;
    }
    case "member.patch":
      must(await sb.from("members").update(op.patch).eq("id", op.id).eq("workspace_id", ws));
      return;
    case "member.remove":
      must(await sb.from("members").delete().eq("id", op.id).eq("workspace_id", ws));
      return;
    case "roster.put": {
      const r = op.roster;
      must(await sb.from("rosters").upsert({ id: r.id, workspace_id: ws, name: r.name, acts: r.acts, created_at: iso(r.createdAt) }));
      return;
    }
    case "roster.delete":
      must(await sb.from("rosters").delete().eq("id", op.id).eq("workspace_id", ws));
      return;
  }
}
