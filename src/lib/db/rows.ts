// The one place client types become table rows and back. Pure, so the round trip is unit-tested.

import type { Artifact, Conversation, Message, Mode } from "../agent/types.ts";
import type { Project } from "../model.ts";

const ms = (t: string | null | undefined) => (t ? Date.parse(t) : Date.now());
const iso = (n: number) => new Date(n).toISOString();

export type ConversationRow = { id: string; workspace_id: string; project_id: string | null; title: string; mode: string; entities: Record<string, string>; created_by: string | null; updated_at: string };
export type MessageRow = { id: string; conversation_id: string; role: Message["role"]; text: string; steps: Message["steps"] | null; choices: Message["choices"] | null; branches?: Message["branches"] | null; created_at: string };
export type ArtifactRow = { id: string; message_id: string; workspace_id: string; type: string; position: number; data: Artifact; updated_at?: string };
export type ProjectRow = { id: string; workspace_id: string; name: string; kind: Project["kind"]; tone: string; headliner: string; city: string; date: string; venue: string; capacity: number; created_at: string; updated_at: string };

export function conversationToRows(c: Conversation, ws: string, userId: string | null, now = Date.now()) {
  const conversation: ConversationRow = { id: c.id, workspace_id: ws, project_id: c.projectId ?? null, title: c.title, mode: c.mode, entities: c.entities ?? {}, created_by: userId, updated_at: iso(c.updatedAt) };
  const messages: MessageRow[] = c.messages.map((m) => ({ id: m.id, conversation_id: c.id, role: m.role, text: m.text, steps: m.steps ?? null, choices: m.choices ?? null, ...(m.branches && { branches: m.branches }), created_at: iso(m.createdAt) }));
  const artifacts: ArtifactRow[] = c.messages.flatMap((m) => (m.artifacts ?? []).map((a, i) => ({ id: a.id, message_id: m.id, workspace_id: ws, type: a.type, position: i, data: a, updated_at: iso(now) })));
  return { conversation, messages, artifacts };
}

export function rowsToConversations(convs: ConversationRow[], msgs: MessageRow[], arts: Pick<ArtifactRow, "message_id" | "position" | "data">[]): Conversation[] {
  const byMessage = new Map<string, Artifact[]>();
  for (const a of [...arts].sort((x, y) => x.position - y.position)) (byMessage.get(a.message_id) ?? byMessage.set(a.message_id, []).get(a.message_id)!).push(a.data);
  const byConv = new Map<string, Message[]>();
  for (const m of [...msgs].sort((x, y) => ms(x.created_at) - ms(y.created_at))) {
    const message: Message = { id: m.id, role: m.role, text: m.text, createdAt: ms(m.created_at) };
    if (m.steps) message.steps = m.steps;
    if (m.choices) message.choices = m.choices;
    if (m.branches) message.branches = m.branches;
    const a = byMessage.get(m.id);
    if (a) message.artifacts = a;
    (byConv.get(m.conversation_id) ?? byConv.set(m.conversation_id, []).get(m.conversation_id)!).push(message);
  }
  return convs.map((c) => {
    const out: Conversation = { id: c.id, title: c.title, mode: c.mode as Mode, updatedAt: ms(c.updated_at), messages: byConv.get(c.id) ?? [] };
    if (c.project_id) out.projectId = c.project_id;
    if (c.entities && Object.keys(c.entities).length) out.entities = c.entities;
    return out;
  });
}

export const projectToRow = (p: Project, ws: string): ProjectRow => ({ id: p.id, workspace_id: ws, name: p.name, kind: p.kind, tone: p.tone, headliner: p.headliner, city: p.city, date: p.date, venue: p.venue, capacity: p.capacity, created_at: iso(p.createdAt), updated_at: iso(p.updatedAt) });

export const rowToProject = (r: ProjectRow): Project => ({ id: r.id, name: r.name, kind: r.kind, tone: r.tone, headliner: r.headliner, city: r.city, date: r.date, venue: r.venue, capacity: r.capacity, createdAt: ms(r.created_at), updatedAt: ms(r.updated_at) });
